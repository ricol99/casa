var assert = require('assert');
var http = require('http');
var NamedObject = require('../namedobject');
var CasaConsoleApi = require('../consoleapis/casaconsoleapi');
var ConsoleApiService = require('../services/consoleapiservice');
var PeerCasa = require('../peercasa');
var McpService = require('../services/mcpservice');

function fixture(name) {
   function node(address, type, parent) {
      var object = Object.create(NamedObject.prototype);
      Object.assign(object, { uName: address, name: address.split(':').pop(), type: type, myNamedObjects: {}, owner: parent });
      object.superType = function() { return type === 'property' ? 'property' : 'thing'; };
      if (parent) parent.myNamedObjects[object.name] = object;
      return object;
   }
   var gang = node(':', 'gang');
   var casa = gang.casa = { name: name, uName: ':' + name, sources: {} };
   var room = node(':lounge', 'room', gang);
   var compound = node(':lounge:decorations', 'thing', room);
   var tree = node(':lounge:decorations:christmas-tree', 'switch', compound);
   compound.local = tree.local = true;
   var property = node(tree.uName + ':ON', 'property', tree);
   property.value = 'must not export';
   [room, compound, tree].forEach(function(object) { object.casa = casa; casa.sources[object.uName] = object; });
   var mirror = node(':remote', 'peersource', gang); mirror.fromPeer = true;
   node(':remote:hidden', 'switch', mirror);
   casa.bowingRoot = node(':bow-root', 'namedobject');
   var bowed = node(':backup', 'room', casa.bowingRoot); bowed.casa = casa; casa.sources[bowed.uName] = bowed;
   gang.findNamedObject = function(address) { return address === casa.uName ? casa : address === bowed.uName ? mirror : casa.sources[address]; };
   var api = Object.create(CasaConsoleApi.prototype); api.gang = gang; api.sessions = {};
   var service = Object.create(ConsoleApiService.prototype); service.gang = gang; service.sessions = {}; service.uName = ':console';
   service.findOrCreateConsoleApiObject = function() { return api; };
   casa.findService = function() { return service; };
   return { gang: gang, casa: casa, service: service, tree: tree, api: api };
}

(async function() {
   var local = fixture('gateway');
   var remote = fixture('host');
   var mcp = Object.create(McpService.prototype); mcp.gang = local.gang;
   var server = http.createServer(), io = require('socket.io')(server), client;
   var peer = Object.create(PeerCasa.prototype);
   Object.assign(peer, { name: 'host', uName: ':host', casa: local.casa, incompleteRequests: {}, reqId: 0, connected: true, sources: {} });
   local.gang.peercasas = { host: peer };
   local.gang.findPeerCasa = function(name) { return this.peercasas[name]; };
   var messages = [], held;
   io.on('connection', function(socket) {
      var receiver = Object.create(PeerCasa.prototype);
      Object.assign(receiver, { uName: ':gateway', casa: remote.casa, socket: socket });
      socket.on('console-command-req', function(data) {
         messages.push(data.method);
         held = function() { receiver.socketConsoleCommandReqCb(data); };
         // Hold the first reply until the second peer request has been dispatched.
         if (messages.length > 1) held();
      });
      ['subscribe-source', 'unsubscribe-source', 'source-subscription-registered', 'source-interest-in-new-child', 'set-source-property-req'].forEach(function(event) {
         socket.on(event, function() { throw new Error('Unexpected control traffic: ' + event); });
      });
   });
   function call(args) { return new Promise(function(resolve) {
      mcp.handleToolCall(1, { name: 'casa.discover_objects', arguments: args || {} }, { status: function() { return this; }, json: resolve });
   }); }
   try {
      await new Promise(function(resolve, reject) { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
      client = require('socket.io-client')('http://127.0.0.1:' + server.address().port, { transports: ['websocket'], reconnection: false });
      await new Promise(function(resolve, reject) { client.on('connect', resolve); client.on('connect_error', reject); });
      var sentEvents = [];
      var emit = client.emit;
      client.emit = function(event) { sentEvents.push(event); return emit.apply(this, arguments); };
      peer.socket = client;
      client.on('console-command-resp', peer.socketConsoleCommandRespCb.bind(peer));
      // A second host callback is held until the first real socket request arrives.
      var secondCallback;
      local.gang.peercasas.second = { name: 'second', uName: ':second', sendConsoleCommand: function(command, callback) {
         assert.strictEqual(command.method, 'discoverObjects'); secondCallback = callback;
      } };
      var pending = call();
      await new Promise(function(resolve) {
         var poll = setInterval(function() { if (held) { clearInterval(poll); resolve(); } }, 5);
      });
      assert(secondCallback, 'All hosts must be dispatched before waiting for a reply');
      secondCallback(null, { casa: 'second', objects: [] }); held();
      var result = (await pending).result.structuredContent;
      assert.strictEqual(result.complete, true);
      assert.deepStrictEqual(result.casas.map(function(host) { return host.casa; }), ['gateway', 'host', 'second']);
      result.casas.slice(0, 2).forEach(function(host) {
         var tree = host.objects.find(function(object) { return object.uName === remote.tree.uName; });
         assert(tree && tree.local && tree.active);
         assert.strictEqual(tree.parent, ':lounge:decorations');
         assert(!host.objects.some(function(object) { return object.uName.startsWith(':remote') || object.type === 'property'; }));
         assert.strictEqual(host.objects.find(function(object) { return object.uName === ':backup'; }).active, false);
         assert(!JSON.stringify(host).includes('must not export'));
      });
      assert.deepStrictEqual(Object.keys(peer.sources), []);
      assert.deepStrictEqual(Object.keys(remote.service.sessions), []);
      assert.deepStrictEqual(messages, ['discoverObjects']);
      // Partial failure and bounded response, then ignore a late reply.
      local.gang.peercasas.offline = { name: 'offline', uName: ':offline', sendConsoleCommand: function(command, cb) { cb('Hosting Casa is disconnected'); } };
      result = (await call({ timeoutSeconds: 1 })).result.structuredContent;
      assert.strictEqual(result.complete, false);
      assert.strictEqual(result.casas.find(function(host) { return host.casa === 'second'; }).error, 'Discovery timed out');
      assert.strictEqual(result.casas.find(function(host) { return host.casa === 'offline'; }).error, 'Hosting Casa is disconnected');
      secondCallback(null, { casa: 'second', objects: [] });
      assert.strictEqual(result.casas.find(function(host) { return host.casa === 'second'; }).error, 'Discovery timed out');
      assert((await call({ timeoutSeconds: 0 })).error);
      assert.deepStrictEqual(Object.keys(peer.sources), []);
      assert.strictEqual(remote.tree.local, true);
      assert(sentEvents.every(function(event) { return event === 'console-command-req'; }));
      assert.deepStrictEqual(Object.keys(peer.incompleteRequests), []);
      var command = Object.create(require('../consolecmds/casaconsolecmd').prototype);
      command.checkArguments = function() {};
      command.executeParsedCommand = function(name, args) {
         assert.strictEqual(name, 'discoverObjects'); assert.deepStrictEqual(args, []);
      };
      command.discoverObjects([], function() {});
      console.log('[PASS] Parallel discovery, local compound tree walking, bowed instances, compact host grouping, partial timeout and no mirrors/subscriptions');
   }
   finally { if (client) client.close(); io.close(); if (server.listening) server.close(); }
})().catch(function(error) { console.error(error); process.exitCode = 1; });
