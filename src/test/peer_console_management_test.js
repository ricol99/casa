var assert = require('assert');
var http = require('http');
var PeerCasa = require('../peercasa');
var ConsoleApiService = require('../services/consoleapiservice');
var SourceBaseConsoleApi = require('../consoleapis/sourcebaseconsoleapi');
var McpService = require('../services/mcpservice');
var PeerSocketRequestor = require('../peersocketrequestor');

(async function() {
   var server = http.createServer();
   var io = require('socket.io')(server);
   var client;
   var gateway = Object.create(PeerCasa.prototype);
   gateway.uName = ':host'; gateway.name = 'host'; gateway.casa = { uName: ':gateway' };
   gateway.incompleteRequests = {}; gateway.reqId = 0; gateway.sources = {};
   var value = false, writes = 0;
   var child = { uName: ':lounge:tree', local: true, setProperty: function(name, next, data) {
      assert.strictEqual(name, 'ON'); assert.strictEqual(data.sourceName, 'mcp'); value = next; writes++; return true;
   } };
   var prototype = Object.create(SourceBaseConsoleApi.prototype);
   prototype.describeSourceState = function(session, args, cb) {
      setTimeout(function() { cb(null, { value: value, local: true }); }, 10);
   };
   var api = Object.create(prototype);
   api.myObj = function() { return child; }; api.sessions = {};
   var service = Object.create(ConsoleApiService.prototype);
   service.uName = ':console'; service.sessions = {};
   service.gang = { findNamedObject: function(name) { return name === child.uName ? child : null; } };
   service.findOrCreateConsoleApiObject = function() { return api; };
   var interactive = service.getSession('interactive', null);
   var owner = Object.create(PeerCasa.prototype);
   owner.uName = ':gateway'; owner.casa = { findService: function() { return service; } };
   io.on('connection', function(socket) {
      owner.socket = socket;
      socket.on('console-command-req', owner.socketConsoleCommandReqCb.bind(owner));
   });
   function request(command) {
      return new Promise(function(resolve) { gateway.sendConsoleCommand(command, function(error, result) { resolve({ error: error, result: result }); }); });
   }
   try {
      await new Promise(function(resolve, reject) { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
      client = require('socket.io-client')('http://127.0.0.1:' + server.address().port, { transports: ['websocket'], reconnection: false });
      await new Promise(function(resolve, reject) { client.on('connect', resolve); client.on('connect_error', reject); });
      gateway.socket = client; gateway.connected = true;
      client.on('console-command-resp', gateway.socketConsoleCommandRespCb.bind(gateway));
      var mcp = Object.create(McpService.prototype);
      mcp.gang = { casa: { name: 'gateway' }, findPeerCasa: function(name) { return name === 'host' ? gateway : null; },
         findNamedObject: function(name) { return name === ':lounge' ? { casa: gateway } : null; } };
      function call(name, args) { return new Promise(function(resolve) {
         mcp.handleToolCall(1, { name: name, arguments: args }, { status: function() { return this; }, json: resolve });
      }); }
      var result = await call('casa.set_property', { uName: child.uName, property: 'ON', value: true });
      assert.strictEqual(result.result.structuredContent.ok, true); assert.strictEqual(value, true);
      var results = await Promise.all([
         call('casa.describe_source_state', { uName: child.uName, casa: 'host' }),
         request({ obj: ':missing', method: 'describeSourceState', arguments: [] }),
         new Promise(function(resolve) { interactive.executeCommand({ obj: child.uName, method: 'describeSourceState', arguments: [] }, function(error, result) { assert.ifError(error); resolve(result); }); })
      ]);
      assert.strictEqual(results[0].result.structuredContent.value, true);
      assert.strictEqual(results[1].error, 'Object not found!');
      assert.strictEqual(results[2].local, true);
      assert.deepStrictEqual(Object.keys(service.sessions), ['interactive']);
      assert.deepStrictEqual(Object.keys(gateway.sources), []);
      assert.deepStrictEqual(Object.keys(gateway.incompleteRequests), []);
      var unknown = await request({ obj: child.uName, method: 'noSuchCommand', arguments: [] });
      assert(unknown.error);
      // An unanswered management request must not be emitted again during reconnect replay.
      var emissions = 0;
      gateway.socket = { emit: function() { emissions++; } };
      var pending = request({ obj: child.uName, method: 'setProperty', arguments: ['ON', false] });
      gateway.resendIncompleteRequests(); assert.strictEqual(emissions, 1);
      var id = Object.keys(gateway.incompleteRequests)[0];
      gateway.sourceCommandProtocol.completeResponse({ requestor: ':gateway', requestId: id, result: { error: 'test cleanup' } });
      assert.strictEqual((await pending).error, 'test cleanup');
      gateway.connected = false;
      assert.strictEqual((await request({})).error, 'Hosting Casa is disconnected');
      await new Promise(function(resolve) {
         var timer = new PeerSocketRequestor({ requestId: 'timeout', socket: { emit: function() {} }, timeoutMs: 5,
            callback: function(error) { assert.strictEqual(error, 'timeout'); }, replay: false });
         timer.sendRequest({ message: 'ignored', data: {} }, resolve);
      });
      assert.strictEqual(writes, 1);
      var localCasa = { name: 'host', findService: function() { return service; } };
      child.casa = localCasa;
      mcp.gang = { casa: localCasa, findNamedObject: service.gang.findNamedObject };
      result = await call('casa.set_property', { uName: child.uName, property: 'ON', value: false });
      assert.strictEqual(result.result.structuredContent.ok, true);
      assert.strictEqual(value, false); assert.strictEqual(writes, 2);
      assert.strictEqual(service.sessions.interactive, interactive);
      console.log('[PASS] Remote unmirrored child, MCP routing, concurrent console session, errors, timeout and no management replay');
   }
   finally {
      if (client) client.close();
      io.close();
      if (server.listening) server.close();
   }
})().catch(function(error) { console.error(error); process.exitCode = 1; });
