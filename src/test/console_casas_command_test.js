var assert = require('assert');
var Console = require('../console');
var ConsoleCmd = require('../consolecmd');
var RemoteCasa = Console.__testExports.RemoteCasa;
var OfflineCasa = Console.__testExports.OfflineCasa;

function runTest(_name, _fn) {
   try {
      _fn();
      process.stdout.write("[PASS] " + _name + "\n");
   }
   catch (_err) {
      process.stderr.write("[FAIL] " + _name + "\n");
      process.stderr.write(_err.stack + "\n");
      process.exit(1);
   }
}

function createConsoleCmd() {
   var cmd = Object.create(ConsoleCmd.prototype);

   cmd.console = {
      getCasas: function() {
         return [ { name: ":kitchen", connected: true } ];
      },
      getUnregisteredCasas: function() {
         return [ { name: ":unregistered-aa-bb-cc", macAddress: "aa:bb:cc" } ];
      },
      claimUnregisteredCasa: function(_params, _callback) {
         _callback(null, {
            casaName: _params.name,
            macAddress: _params.address,
            restartRequired: true
         });
      }
   };

   return cmd;
}

runTest("casas defaults to show registered casas", function() {
   var cmd = createConsoleCmd();

   cmd.casas([], function(_err, _result) {
      assert.strictEqual(_err, null);
      assert.deepStrictEqual(_result, [ { name: ":kitchen", connected: true } ]);
   });
});

runTest("casas show lists registered casas", function() {
   var cmd = createConsoleCmd();

   cmd.casas([ "show" ], function(_err, _result) {
      assert.strictEqual(_err, null);
      assert.deepStrictEqual(_result, [ { name: ":kitchen", connected: true } ]);
   });
});

runTest("casas show --unregistered lists unregistered casas", function() {
   var cmd = createConsoleCmd();

   cmd.casas([ "show", "--unregistered" ], function(_err, _result) {
      assert.strictEqual(_err, null);
      assert.deepStrictEqual(_result, [ { name: ":unregistered-aa-bb-cc", macAddress: "aa:bb:cc" } ]);
   });
});

runTest("casas rejects unsupported subcommands", function() {
   var cmd = createConsoleCmd();

   cmd.casas([ "capture" ], function(_err, _result) {
      assert.match(_err, /Unsupported casas command/);
      assert.strictEqual(_result, undefined);
   });
});

runTest("casas add claims an unregistered casa", function() {
   var cmd = createConsoleCmd();
   var capturedParams = null;

   cmd.addCasa = function(_params, _callback) {
      capturedParams = _params;
      _callback(null, {
         casaName: _params.name,
         macAddress: _params.address,
         restartRequired: true
      });
   };

   cmd.casas([ "add", "--name", "kitchen", "--address", "aa-bb-cc-dd-ee-ff" ], function(_err, _result) {
      assert.strictEqual(_err, null);
      assert.deepStrictEqual(_result, {
         casaName: "kitchen",
         macAddress: "aa-bb-cc-dd-ee-ff",
         restartRequired: true
      });
   });

   assert.deepStrictEqual(capturedParams, {
      command: "add",
      name: "kitchen",
      address: "aa-bb-cc-dd-ee-ff"
   });
});

runTest("casas add requires name and address", function() {
   var cmd = createConsoleCmd();

   cmd.casas([ "add", "--name", "kitchen" ], function(_err, _result) {
      assert.match(_err, /Casa address not provided/);
      assert.strictEqual(_result, undefined);
   });
});

runTest("casas add reports known unregistered addresses when address is not found", function() {
   var cmd = createConsoleCmd();

   cmd.console.findUnregisteredCasaByAddress = function() {
      return null;
   };
   cmd.console.getUnregisteredCasas = function() {
      return [ { name: ":unregistered-aa-bb-cc", macAddress: "aa:bb:cc:dd:ee:ff" } ];
   };

   cmd.casas([ "add", "--name", "kitchen", "--address", "aa-bb-cc-dd-ee-f" ], function(_err, _result) {
      assert.match(_err, /Unable to find unregistered casa/);
      assert.match(_err, /aa:bb:cc:dd:ee:ff/);
      assert.strictEqual(_result, undefined);
   });
});

runTest("console tracks unregistered discovery events", function() {
   var consoleObj = Object.create(Console.prototype);

   consoleObj.unregisteredCasas = {};
   consoleObj.connectUnregisteredCasa = function(_entry) {
      _entry.connected = true;
   };

   consoleObj.unregisteredCasaFound({
      name: ":unregistered-aa-bb-cc",
      gang: "unregistered",
      address: { host: "pi.local", port: 8999 },
      discoveryTransportName: "mdns",
      messageTransportName: "http",
      tier: 1,
      metadata: {
         unregistered: true,
         macAddress: "aa:bb:cc"
      }
   });

   assert.deepStrictEqual(consoleObj.getUnregisteredCasas(), [
      {
         name: ":unregistered-aa-bb-cc",
         gang: "unregistered",
         address: { host: "pi.local", port: 8999 },
         discoveryTransportName: "mdns",
         messageTransportName: "http",
         tier: 1,
         macAddress: "aa:bb:cc",
         connected: true,
         connecting: false,
         lastError: undefined
      }
   ]);

   consoleObj.unregisteredCasaLost({
      name: ":unregistered-aa-bb-cc",
      metadata: { unregistered: true }
   });

   assert.deepStrictEqual(consoleObj.getUnregisteredCasas(), []);
});

runTest("console routes unregistered casa-up events away from RemoteCasa", function() {
   var consoleObj = Object.create(Console.prototype);

   consoleObj.remoteCasas = {};
   consoleObj.unregisteredCasas = {};
   consoleObj.connectUnregisteredCasa = function(_entry) {
      _entry.connected = true;
   };

   consoleObj.casaFound({
      name: ":unregistered-aa-bb-cc",
      gang: "unregistered",
      address: { host: "pi.local", port: 8999 },
      discoveryTransportName: "mdns",
      messageTransportName: "http",
      tier: 1,
      metadata: {
         unregistered: true,
         macAddress: "aa:bb:cc"
      }
   });

   assert.deepStrictEqual(consoleObj.remoteCasas, {});
   assert.deepStrictEqual(consoleObj.getUnregisteredCasas(), [
      {
         name: ":unregistered-aa-bb-cc",
         gang: "unregistered",
         address: { host: "pi.local", port: 8999 },
         discoveryTransportName: "mdns",
         messageTransportName: "http",
         tier: 1,
         macAddress: "aa:bb:cc",
         connected: true,
         connecting: false,
         lastError: undefined
      }
   ]);

   consoleObj.casaLost({
      name: ":unregistered-aa-bb-cc",
      metadata: {
         unregistered: true,
         macAddress: "aa:bb:cc"
      }
   });

   assert.deepStrictEqual(consoleObj.getUnregisteredCasas(), []);
});

runTest("console prompt uses refreshed default casa after disconnect", function() {
   var consoleObj = Object.create(Console.prototype);
   var prompt = null;

   consoleObj.remoteCasas = {
      ":old-casa": { name: ":old-casa", connected: false },
      ":new-casa": { name: ":new-casa", connected: true }
   };
   consoleObj.defaultCasa = consoleObj.remoteCasas[":old-casa"];
   consoleObj.sourceCasa = null;
   consoleObj.connectedCasas = 2;
   consoleObj.offline = false;
   consoleObj.currentScope = ":";
   consoleObj.currentCmdObj = { casaName: ":old-casa", sourceCasa: ":old-casa" };
   consoleObj.gangConsoleCmd = {
      findNamedObject: function() {
         return null;
      }
   };
   consoleObj.rl = {
      setPrompt: function(_prompt) {
         prompt = _prompt;
      }
   };

   consoleObj.refreshConnectedCasaState();
   consoleObj.updatePrompt();

   assert.strictEqual(consoleObj.connectedCasas, 1);
   assert.strictEqual(consoleObj.defaultCasa, consoleObj.remoteCasas[":new-casa"]);
   assert.strictEqual(prompt.indexOf("[:new-casa*:1]") !== -1, true);
});

runTest("console prompt ignores disconnected command source casa", function() {
   var consoleObj = Object.create(Console.prototype);
   var prompt = null;

   consoleObj.remoteCasas = {
      "casa-test-access": { name: "casa-test-access", connected: false }
   };
   consoleObj.defaultCasa = null;
   consoleObj.sourceCasa = null;
   consoleObj.connectedCasas = 0;
   consoleObj.currentScope = ":";
   consoleObj.currentCmdObj = { casaName: "casa-test-access", sourceCasa: "casa-test-access" };
   consoleObj.gangConsoleCmd = {
      findNamedObject: function() {
         return { sourceCasa: "casa-test-access" };
      }
   };
   consoleObj.rl = {
      setPrompt: function(_prompt) {
         prompt = _prompt;
      }
   };

   consoleObj.updatePrompt();

   assert.strictEqual(prompt.indexOf("[null*:0]") !== -1, true);
});

runTest("web ui socket lists and adds unregistered casas through console command", function() {
   var consoleObj = Object.create(Console.prototype);
   var handlers = {};
   var emissions = [];
   var addArgs = null;
   var socket = {
      on: function(_event, _handler) {
         handlers[_event] = _handler;
      },
      emit: function(_event, _payload) {
         emissions.push({ event: _event, payload: _payload });
      }
   };

   consoleObj.webUiSockets = new Set();
   consoleObj.getUnregisteredCasas = function() {
      return [ { name: ":unregistered-aa-bb-cc", macAddress: "aa:bb:cc:dd:ee:ff" } ];
   };
   consoleObj.gangConsoleCmd = {
      casas: function(_args, _callback) {
         addArgs = _args;
         _callback(null, { casaName: "kitchen", restartOrdered: true });
      }
   };

   consoleObj.webUiSocketConnected(socket);
   handlers.getUnregisteredCasas({ id: "list-1" });
   handlers.addUnregisteredCasa({ id: "add-1", name: "kitchen", address: "aa-bb-cc-dd-ee-ff" });

   assert.deepStrictEqual(emissions[0], {
      event: "unregistered-casas-output",
      payload: {
         id: "list-1",
         ok: true,
         result: [ { name: ":unregistered-aa-bb-cc", macAddress: "aa:bb:cc:dd:ee:ff" } ]
      }
   });
   assert.deepStrictEqual(addArgs, [ "add", "--name", "kitchen", "--address", "aa-bb-cc-dd-ee-ff" ]);
   assert.deepStrictEqual(emissions[1], {
      event: "add-unregistered-casa-output",
      payload: {
         id: "add-1",
         ok: true,
         result: { casaName: "kitchen", restartOrdered: true },
         error: null
      }
   });
});

runTest("console claims discovered unregistered casa by MAC address", function() {
   var consoleObj = Object.create(Console.prototype);
   var claimPayload = null;

   consoleObj.gang = { name: "gang-collin" };
   consoleObj.unregisteredCasas = {
      ":unregistered-aa-bb-cc": {
         name: ":unregistered-aa-bb-cc",
         gang: "unregistered",
         address: { host: "pi.local", port: 8999 },
         macAddress: "aa:bb:cc:dd:ee:ff"
      }
   };
   consoleObj.sendUnregisteredCasaClaim = function(_unregisteredCasa, _payload, _callback) {
      claimPayload = {
         unregisteredCasa: _unregisteredCasa,
         payload: _payload
      };
      _callback(null, { ok: true });
   };

   consoleObj.claimUnregisteredCasa({
      name: "kitchen",
      address: "aa-bb-cc-dd-ee-ff"
   }, function(_err, _result) {
      assert.strictEqual(_err, null);
      assert.deepStrictEqual(_result, { ok: true });
   });

   assert.strictEqual(claimPayload.unregisteredCasa.name, ":unregistered-aa-bb-cc");
   assert.deepStrictEqual(claimPayload.payload, {
      casaName: "kitchen",
      gangName: "gang-collin",
      macAddress: "aa:bb:cc:dd:ee:ff"
   });
   assert.strictEqual(!!consoleObj.unregisteredCasas[":unregistered-aa-bb-cc"], true);
});

runTest("console sends unregistered claim through connected RemoteCasa", function() {
   var consoleObj = Object.create(Console.prototype);
   var capturedCommand = null;

   consoleObj.unregisteredCasas = {
      ":unregistered-aa-bb-cc": {
         name: ":unregistered-aa-bb-cc",
         remoteCasa: {
            connected: true,
            executeParsedCommand: function(_command, _callback) {
               capturedCommand = _command;
               _callback(null, {
                  casaName: "kitchen",
                  gangName: "gang-collin",
                  macAddress: "aa:bb:cc:dd:ee:ff",
                  restartRequired: true
               });
               return true;
            },
            disconnect: function(_params) {
               this.disconnected = _params && _params.disableAutoReconnect && _params.silent;
            }
         }
      }
   };

   consoleObj.sendUnregisteredCasaClaim(consoleObj.unregisteredCasas[":unregistered-aa-bb-cc"], {
      casaName: "kitchen",
      gangName: "gang-collin",
      macAddress: "aa:bb:cc:dd:ee:ff"
   }, function(_err, _result) {
      assert.strictEqual(_err, null);
      assert.deepStrictEqual(_result, {
         casaName: "kitchen",
         gangName: "gang-collin",
         macAddress: "aa:bb:cc:dd:ee:ff",
         restartRequired: true
      });
   });

   assert.deepStrictEqual(capturedCommand, [
      ":unregistered-aa-bb-cc",
      "claimUnregisteredCasa",
      [ {
         casaName: "kitchen",
         gangName: "gang-collin",
         macAddress: "aa:bb:cc:dd:ee:ff"
      } ]
   ]);
   assert.strictEqual(consoleObj.unregisteredCasas[":unregistered-aa-bb-cc"].remoteCasa.disconnected, undefined);
   assert.strictEqual(!!consoleObj.unregisteredCasas[":unregistered-aa-bb-cc"], true);
});

runTest("console removes unregistered casa and disconnects remote", function() {
   var consoleObj = Object.create(Console.prototype);
   var entry = {
      name: ":unregistered-aa-bb-cc",
      remoteCasa: {
         disconnect: function(_params) {
            this.disconnected = _params;
         }
      }
   };

   consoleObj.unregisteredCasas = {
      ":unregistered-aa-bb-cc": entry
   };

   consoleObj.removeUnregisteredCasa(entry);

   assert.deepStrictEqual(entry.remoteCasa.disconnected, {
      disableAutoReconnect: true,
      silent: true
   });
   assert.deepStrictEqual(consoleObj.unregisteredCasas, {});
});

runTest("casas add claims, pushes bootstrap DBs and restarts", function() {
   var cmd = Object.create(ConsoleCmd.prototype);
   var unregisteredCasa = {
      name: ":unregistered-aa-bb-cc",
      address: { host: "pi.local", port: 9101 },
      remoteCasa: { connected: true }
   };
   var sentCommand = null;
   var removedCasa = null;
   var restartedCasa = null;

   cmd.gang = {
      name: "gang-collin",
      getDb: function() {
         return {
            name: "gang-collin-db",
            getHash: function() {
               return { hash: "gang-hash" };
            },
            readAll: function(_callback) {
               _callback(null, [ { _id: "gang-doc" } ]);
            }
         };
      }
   };
   cmd.console = {
      findUnregisteredCasaByAddress: function(_address) {
         assert.strictEqual(_address, "aa-bb-cc-dd-ee-ff");
         return unregisteredCasa;
      },
      claimUnregisteredCasa: function(_params, _callback) {
         assert.deepStrictEqual(_params, {
            name: "kitchen",
            address: "aa-bb-cc-dd-ee-ff"
         });
         _callback(null, {
            casaName: "kitchen",
            gangName: "gang-collin",
            macAddress: "aa:bb:cc:dd:ee:ff",
            restartRequired: true
         });
      },
      sendCommandToCasa: function(_remoteCasa, _command, _method, _callback) {
         assert.strictEqual(_remoteCasa, unregisteredCasa.remoteCasa);
         assert.strictEqual(_method, "executeParsedCommand");
         sentCommand = _command;
         _callback(null, { replaced: true });
      },
      removeUnregisteredCasa: function(_entry) {
         removedCasa = _entry;
      }
   };
   cmd.bootstrapCasaDbPayload = function(_entry, _casaName, _callback) {
      assert.strictEqual(_entry, unregisteredCasa);
      assert.strictEqual(_casaName, "kitchen");
      _callback(null, {
         dbName: "kitchen-db",
         hash: { hash: "casa-hash" },
         docs: [ { _id: "kitchen-doc" } ]
      });
   };
   cmd.restartUnregisteredCasa = function(_entry, _callback) {
      restartedCasa = _entry;
      _callback(null, true);
   };

   cmd.addCasa({
      name: "kitchen",
      address: "aa-bb-cc-dd-ee-ff"
   }, function(_err, _result) {
      assert.strictEqual(_err, null);
      assert.deepStrictEqual(_result, {
         casaName: "kitchen",
         gangName: "gang-collin",
         macAddress: "aa:bb:cc:dd:ee:ff",
         dbsPushed: true,
         dbResult: { replaced: true },
         restartOrdered: true
      });
   });

   assert.deepStrictEqual(sentCommand, [
      ":unregistered-aa-bb-cc",
      "replaceDbs",
      [ [
         {
            dbName: "gang-collin-db",
            hash: { hash: "gang-hash" },
            docs: [ { _id: "gang-doc" } ]
         },
         {
            dbName: "kitchen-db",
            hash: { hash: "casa-hash" },
            docs: [ { _id: "kitchen-doc" } ]
         }
      ] ]
   ]);
   assert.strictEqual(restartedCasa, unregisteredCasa);
   assert.strictEqual(removedCasa, unregisteredCasa);
});

runTest("RemoteCasa executes parsed command after normal connect", function() {
   var handlers = {};
   var emitted = [];
   var socket = {
      on: function(_event, _handler) {
         handlers[_event] = _handler;
      },
      emit: function(_event, _data) {
         emitted.push({ event: _event, data: _data });

         if (_event === "executeCommand") {
            handlers["execute-output"]({
               result: {
                  ok: true,
                  casaName: "kitchen"
               }
            });
         }
      },
      disconnect: function() {
         this.disconnected = true;
      }
   };
   var remoteCasa = new RemoteCasa({
      name: ":unregistered-aa-bb-cc",
      address: { host: "pi.local", port: 8999 },
      messageTransportName: "http",
      autoDbSync: false,
      subscribeLiveUpdates: false
   }, {
      secureMode: false,
      gang: {
         casa: {
            mainWebService: {
               newIoSocket: function(_address, _route, _secure, _messageTransportName) {
                  assert.deepStrictEqual(_address, { host: "pi.local", port: 8999 });
                  assert.strictEqual(_route, "/consoleapi/io");
                  assert.strictEqual(_secure, false);
                  assert.strictEqual(_messageTransportName, "http");
                  return socket;
               }
            }
         }
      }
   });

   remoteCasa.start();
   handlers.connect();

   assert.strictEqual(remoteCasa.connected, true);
   assert.strictEqual(remoteCasa.executeParsedCommand([
      ":unregistered-aa-bb-cc",
      "claimUnregisteredCasa",
      [ { casaName: "kitchen" } ]
   ], function(_err, _result) {
      assert.strictEqual(_err, null);
      assert.deepStrictEqual(_result, {
         ok: true,
         casaName: "kitchen"
      });
   }), true);

   assert.deepStrictEqual(emitted, [
      { event: "getCasaInfo", data: undefined },
	      {
	         event: "executeCommand",
	         data: {
	            obj: ":unregistered-aa-bb-cc",
	            method: "claimUnregisteredCasa",
	            arguments: [ { casaName: "kitchen" } ],
	            requestId: emitted[1].data.requestId
	         }
	      }
	   ]);
   assert.ok(emitted[1].data.requestId);
   assert.strictEqual(Object.keys(remoteCasa.pendingConsoleRequests).length, 0);
});

runTest("RemoteCasa correlates overlapping extractScope responses by request id", function() {
   var handlers = {};
   var emitted = [];
   var callbacks = [];
   var socket = {
      on: function(_event, _handler) {
         handlers[_event] = _handler;
      },
      emit: function(_event, _data) {
         emitted.push({ event: _event, data: _data });
      },
      disconnect: function() {
         this.disconnected = true;
      }
   };
   var remoteCasa = new RemoteCasa({
      name: ":remote",
      address: { host: "pi.local", port: 8999 },
      messageTransportName: "pusher",
      autoDbSync: false,
      requestCasaInfo: false,
      subscribeLiveUpdates: false
   }, {
      secureMode: false,
      currentScope: ":",
      gang: {
         casa: {
            mainWebService: {
               newIoSocket: function() {
                  return socket;
               }
            }
         }
      }
   });

   remoteCasa.start();
   handlers.connect();
   remoteCasa.extractScope(":", function(_err, _result) {
      callbacks.push({ name: "first", err: _err, result: _result });
   }, ":");
   remoteCasa.extractScope(":", function(_err, _result) {
      callbacks.push({ name: "second", err: _err, result: _result });
   }, ":");

   var firstRequest = emitted[0].data;
   var secondRequest = emitted[1].data;

   assert.notStrictEqual(firstRequest.requestId, secondRequest.requestId);

   handlers["extract-scope-output"]({
      requestId: secondRequest.requestId,
      result: { matchingScopes: [ "second:" ], remainingStr: "" }
   });
   handlers["extract-scope-output"]({
      requestId: firstRequest.requestId,
      result: { matchingScopes: [ "first:" ], remainingStr: "" }
   });

   assert.deepStrictEqual(callbacks, [
      { name: "second", err: null, result: { matchingScopes: [ "second:" ], remainingStr: "" } },
      { name: "first", err: null, result: { matchingScopes: [ "first:" ], remainingStr: "" } }
   ]);
   assert.strictEqual(Object.keys(remoteCasa.pendingConsoleRequests).length, 0);
});

runTest("RemoteCasa treats LAN discovery as better than an unknown tier", function() {
   var remoteCasa = new RemoteCasa({
      name: ":casa-console",
      address: "gang-casa://gang-collin/:casa-console",
      messageTransportName: "pusher",
      autoDbSync: false,
      requestCasaInfo: false,
      subscribeLiveUpdates: false
   }, {
      secureMode: false,
      gang: {
         casa: {
            mainWebService: {}
         }
      }
   });

   assert.strictEqual(remoteCasa.discoveryParamsAreBetter({
      address: { host: "casa-console.local", port: 8999 },
      messageTransportName: "http",
      tier: 1
   }), true);

   remoteCasa.applyDiscoveryParams({
      address: { host: "casa-console.local", port: 8999 },
      messageTransportName: "http",
      tier: 1
   });

   assert.deepStrictEqual(remoteCasa.address, { host: "casa-console.local", port: 8999 });
   assert.strictEqual(remoteCasa.messageTransportName, "http");
   assert.strictEqual(remoteCasa.discoveryTier, 1);
});

runTest("web ui gang organisation command works through offline casa", function() {
   function FakeGangConsoleCmd() {
   }

   var capturedArgs = null;
   var consoleObj = Object.create(Console.prototype);

   FakeGangConsoleCmd.prototype.organisation = function(_arguments, _callback) {
      capturedArgs = _arguments;
      _callback(null, {
         gangName: "gang-test",
         organisation: "test-org",
         source: "local"
      });
   };

   consoleObj.offline = true;
   consoleObj.remoteCasas = {};
   consoleObj.defaultCasa = null;
   consoleObj.silentWebUiOutputCount = 0;
   consoleObj.gangConsoleCmd = new FakeGangConsoleCmd();
   consoleObj.offlineCasa = Object.create(OfflineCasa.prototype);
   consoleObj.offlineCasa.name = "offlinecasa";
   consoleObj.offlineCasa.owner = consoleObj;

   consoleObj.executeWebUiCommand({
      obj: ":",
      method: "organisation",
      arguments: []
   }, "stale-casa", function(_err, _result) {
      assert.strictEqual(_err, null);
      assert.deepStrictEqual(capturedArgs, []);
      assert.deepStrictEqual(_result, {
         gangName: "gang-test",
         organisation: "test-org",
         source: "local"
      });
   });
});

runTest("web ui gang pusher command works through offline casa", function() {
   function FakeGangConsoleCmd() {
   }

   var capturedArgs = null;
   var consoleObj = Object.create(Console.prototype);

   FakeGangConsoleCmd.prototype.pusher = function(_arguments, _callback) {
      capturedArgs = _arguments;
      _callback(null, {
         configured: true,
         name: "pusher-service",
         appId: "1234567",
         key: "app-key",
         secret: "configured",
         cluster: "eu",
         source: "local"
      });
   };

   consoleObj.offline = true;
   consoleObj.remoteCasas = {};
   consoleObj.defaultCasa = null;
   consoleObj.silentWebUiOutputCount = 0;
   consoleObj.gangConsoleCmd = new FakeGangConsoleCmd();
   consoleObj.offlineCasa = Object.create(OfflineCasa.prototype);
   consoleObj.offlineCasa.name = "offlinecasa";
   consoleObj.offlineCasa.owner = consoleObj;

   consoleObj.executeWebUiCommand({
      obj: ":",
      method: "pusher",
      arguments: []
   }, "stale-casa", function(_err, _result) {
      assert.strictEqual(_err, null);
      assert.deepStrictEqual(capturedArgs, []);
      assert.deepStrictEqual(_result, {
         configured: true,
         name: "pusher-service",
         appId: "1234567",
         key: "app-key",
         secret: "configured",
         cluster: "eu",
         source: "local"
      });
   });
});

process.stdout.write("All console casas command tests passed.\n");
