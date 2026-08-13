var assert = require('assert');
var PeerCasa = require('../peercasa');
var PeerSocketSession = require('../peersocketsession');

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

function createSocket() {
   return {
      disconnected: false,
      emitted: [],
      listeners: {},
      removed: [],
      disconnect: function() {
         this.disconnected = true;
      },
      emit: function(_message, _data) {
         this.emitted.push({ message: _message, data: _data });
      },
      on: function(_message, _handler) {
         this.listeners[_message] = _handler;
      },
      removeListener: function(_message, _handler) {
         this.removed.push({ message: _message, handler: _handler });
         delete this.listeners[_message];
      }
   };
}

function createPeerCasa(_config) {
   var config = _config || {};
   var socket = config.socket || createSocket();
   var peerCasa = Object.create(PeerCasa.prototype);

   peerCasa.uName = config.uName || ":remote-casa";
   peerCasa.connected = config.connected === undefined ? false : config.connected;
   peerCasa.proActiveConnect = config.proActiveConnect === undefined ? true : config.proActiveConnect;
   peerCasa.persistent = false;
   peerCasa.manualDisconnect = false;
   peerCasa.waitingToConnect = false;
   peerCasa.listenersSetUp = false;
   peerCasa.socket = socket;
   peerCasa.sources = {};
   peerCasa.topSources = {};
   peerCasa.incompleteRequests = {};
   peerCasa.loginAs = config.loginAs || "peer";
   peerCasa.deathTime = 1;
   peerCasa.session = new PeerSocketSession({
      owner: peerCasa,
      socket: socket,
      heartbeatIntervalMs: 10,
      heartbeatTimeoutMs: 20,
      initialHeartbeatGraceMs: 10
   });
   peerCasa.gang = {
      version: "1.0",
      removePeerCasaCalls: 0,
      addPeerCasaCalls: 0,
      removePeerCasa: function() {
         this.removePeerCasaCalls++;
      },
      addPeerCasa: function() {
         this.addPeerCasaCalls++;
      },
      refreshSourceListeners: function() {},
      scheduleRefreshSourceListeners: function() {},
      validateUName: function(_uName) {
         return _uName;
      },
      gangDb: {
         getHash: function() {
            return "gang-hash";
         }
      }
   };
   peerCasa.casa = {
      uName: ":local-casa",
      secureMode: false,
      refreshSimpleConfig: function() {
         return {
            exportTree: {
               myNamedObjects: []
            }
         };
      }
   };
   peerCasa.config = {};
   peerCasa.alignPropertyValueCalls = [];
   peerCasa.alignPropertyValue = function(_property, _value, _data) {
      this.alignPropertyValueCalls.push({ property: _property, value: _value, data: _data });
   };
   peerCasa.coldStartCalls = 0;
   peerCasa.coldStart = function() {
      this.coldStartCalls++;
   };
   peerCasa.createSourcesCalls = [];
   peerCasa.createSources = function(_data, _peerCasa) {
      this.createSourcesCalls.push({ data: _data, peerCasa: _peerCasa });
   };
   peerCasa.resendIncompleteRequestsCalls = 0;
   peerCasa.resendIncompleteRequests = function() {
      this.resendIncompleteRequestsCalls++;
   };
   peerCasa.removeCasaListenersCalls = 0;
   peerCasa.removeCasaListeners = function() {
      this.removeCasaListenersCalls++;
   };
   peerCasa.invalidateCalls = 0;
   peerCasa.invalidate = function() {
      this.invalidateCalls++;
   };
   peerCasa.deleteMeIfNeededCalls = 0;
   peerCasa.deleteMeIfNeeded = function() {
      this.deleteMeIfNeededCalls++;
   };
   peerCasa.changeName = function(_name) {
      this.uName = _name;
   };

   return peerCasa;
}

runTest("PeerCasa proactive listener lifecycle is owned by PeerSocketSession", function() {
   var peerCasa = createPeerCasa({ proActiveConnect: true });

   peerCasa.establishListeners();

   assert.strictEqual(peerCasa.listenersSetUp, true);
   assert.strictEqual(peerCasa.session.listenersSetUp, true);
   assert.strictEqual(typeof peerCasa.socket.listeners.connect, "function");
   assert.strictEqual(typeof peerCasa.socket.listeners.loginAACCKK, "function");
   assert.strictEqual(typeof peerCasa.socket.listeners.loginRREEJJ, "function");
   assert.strictEqual(typeof peerCasa.socket.listeners["source-property-changed"], "function");
   assert.strictEqual(typeof peerCasa.socket.listeners.heartbeat, "function");

   peerCasa.deleteSocket();

   assert.strictEqual(peerCasa.listenersSetUp, false);
   assert.strictEqual(peerCasa.session.listenersSetUp, false);
   assert.strictEqual(peerCasa.socket, null);
   assert.strictEqual(peerCasa.session.socket, null);
});

runTest("PeerCasa server listener lifecycle keeps login-only handshake", function() {
   var peerCasa = createPeerCasa({ proActiveConnect: false });

   peerCasa.establishListeners();

   assert.strictEqual(typeof peerCasa.socket.listeners.login, "function");
   assert.strictEqual(peerCasa.socket.listeners.hasOwnProperty("connect"), false);
   assert.strictEqual(peerCasa.socket.listeners.hasOwnProperty("loginAACCKK"), false);
});

runTest("PeerCasa client login preserves existing wire shape", function() {
   var peerCasa = createPeerCasa({ proActiveConnect: true });

   peerCasa.socketConnectCb();

   assert.strictEqual(peerCasa.socket.emitted.length, 1);
   assert.strictEqual(peerCasa.socket.emitted[0].message, "login");
   assert.deepStrictEqual(peerCasa.socket.emitted[0].data, {
      casaName: ":local-casa",
      casaType: "peer",
      casaConfig: {
         exportTree: {
            myNamedObjects: []
         }
      },
      casaVersion: "1.0"
   });

   clearTimeout(peerCasa.loginTimer);
   peerCasa.loginTimer = null;
});

runTest("PeerCasa server login ack preserves existing wire shape", function() {
   var peerCasa = createPeerCasa({ proActiveConnect: false, connected: true });

   peerCasa.loginTimer = setTimeout(function() {}, 1000);
   peerCasa.socketLoginCb({
      casaName: ":remote-casa",
      casaVersion: 1.0,
      casaConfig: {
         exportTree: {
            myNamedObjects: []
         }
      }
   });

   assert.strictEqual(peerCasa.socket.emitted[0].message, "loginAACCKK");
   assert.strictEqual(peerCasa.socket.emitted[0].data.gangHash, "gang-hash");
   assert.strictEqual(peerCasa.socket.emitted[0].data.casaName, ":local-casa");
   assert.deepStrictEqual(peerCasa.socket.emitted[0].data.casaConfig, {
      exportTree: {
         myNamedObjects: []
      }
   });
   assert.strictEqual(peerCasa.createSourcesCalls.length, 1);
   assert.strictEqual(peerCasa.coldStartCalls, 1);
   assert.strictEqual(peerCasa.resendIncompleteRequestsCalls, 1);
   assert.deepStrictEqual(peerCasa.alignPropertyValueCalls[0], {
      property: "ACTIVE",
      value: true,
      data: { sourceName: "remote-casa" }
   });

   peerCasa.stopHeartbeat();
});

runTest("PeerCasa sendMessage and heartbeat delegate through PeerSocketSession", function() {
   var peerCasa = createPeerCasa({ connected: true });

   peerCasa.sendMessage("source-property-changed", { sourceName: ":building" });
   assert.deepStrictEqual(peerCasa.socket.emitted[0], {
      message: "source-property-changed",
      data: { sourceName: ":building" }
   });

   peerCasa.establishHeartbeat();
   assert.ok(peerCasa.intervalId);
   assert.strictEqual(peerCasa.intervalId, peerCasa.session.intervalId);

   peerCasa.socketHeartbeatCb({});
   assert.strictEqual(peerCasa.lastHeartbeat, peerCasa.session.lastHeartbeat);

   peerCasa.stopHeartbeat();
   assert.strictEqual(peerCasa.intervalId, null);
});

runTest("PeerCasa disconnect stops heartbeat and invalidates active peer sources", function() {
   var peerCasa = createPeerCasa({ connected: true });

   peerCasa.establishHeartbeat();
   peerCasa.socketDisconnectCb({});

   assert.strictEqual(peerCasa.connected, false);
   assert.strictEqual(peerCasa.session.connected, false);
   assert.strictEqual(peerCasa.intervalId, null);
   assert.strictEqual(peerCasa.removeCasaListenersCalls, 1);
   assert.strictEqual(peerCasa.invalidateCalls, 1);
   assert.strictEqual(peerCasa.deleteMeIfNeededCalls, 1);
});

process.stdout.write("All peercasa lifecycle tests passed.\n");
