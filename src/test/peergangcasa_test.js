var assert = require('assert');
var PeerGang = require('../peergang');
var PeerGangCasa = require('../peergangcasa');

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
      disconnect: function() {
         this.disconnected = true;
      },
      emit: function(_message, _data) {
         this.emitted.push({ message: _message, data: _data });
      },
      on: function(_message, _handler) {
         this.listeners[_message] = _handler;
      },
      removeListener: function(_message) {
         delete this.listeners[_message];
      }
   };
}

function createSource() {
   return {
      uName: ":building",
      bound: [],
      removed: [],
      properties: {
         "gate-open": {
            getValueType: function() {
               return "boolean";
            }
         }
      },
      on: function(_event, _handler, _subscription) {
         this.bound.push({ event: _event, handler: _handler, subscription: _subscription });
      },
      removeListener: function(_event, _handler, _subscription) {
         this.removed.push({ event: _event, handler: _handler, subscription: _subscription });
      },
      hasProperty: function(_property) {
         return this.properties.hasOwnProperty(_property);
      },
      getProperty: function(_property) {
         return true;
      }
   };
}

runTest("PeerGangCasa subscribes to a local property and publishes cold-start value", function() {
   var socket = createSocket();
   var source = createSource();
   var localGang = {
      name: "home",
      findNamedObject: function(_uName) {
         assert.strictEqual(_uName, ":building");
         return source;
      }
   };
   var peerGangCasa = new PeerGangCasa({
      name: ":remote-casa",
      localGang: localGang,
      localCasa: { uName: ":local-casa", secureMode: false }
   }, null);

   peerGangCasa.serveClient(socket);
   socket.listeners["subscribe-source"]({
      sourceName: ":building",
      property: "gate-open",
      subscription: { gang: "farm-gate" }
   });

   assert.strictEqual(source.bound.length, 1);
   assert.strictEqual(source.bound[0].event, "property-changed");
   assert.deepStrictEqual(source.bound[0].subscription, { gang: "farm-gate" });
   assert.strictEqual(socket.emitted[0].message, "source-property-changed");
   assert.deepStrictEqual(socket.emitted[0].data, {
      sourceName: ":building",
      name: "gate-open",
      value: true,
      valueType: "boolean",
      coldStart: true
   });
});

runTest("PeerGangCasa ref-counts duplicate local property subscriptions", function() {
   var socket = createSocket();
   var source = createSource();
   var peerGangCasa = new PeerGangCasa({
      name: ":remote-casa",
      localGang: {
         name: "home",
         findNamedObject: function() {
            return source;
         }
      },
      localCasa: { uName: ":local-casa", secureMode: false }
   }, null);
   var data = {
      sourceName: ":building",
      property: "gate-open",
      subscription: { gang: "farm-gate" }
   };

   peerGangCasa.serveClient(socket);
   socket.listeners["subscribe-source"](data);
   socket.listeners["subscribe-source"](data);

   assert.strictEqual(source.bound.length, 1);
   assert.strictEqual(peerGangCasa.localSubscriptions[":building:property:gate-open"].refCount, 2);

   socket.listeners["unsubscribe-source"](data);
   assert.strictEqual(source.removed.length, 0);
   assert.strictEqual(peerGangCasa.localSubscriptions[":building:property:gate-open"].refCount, 1);

   socket.listeners["unsubscribe-source"](data);
   assert.strictEqual(source.removed.length, 1);
   assert.strictEqual(peerGangCasa.localSubscriptions.hasOwnProperty(":building:property:gate-open"), false);
});

runTest("PeerGangCasa ignores malformed source subscription messages", function() {
   var socket = createSocket();
   var source = createSource();
   var peerGangCasa = new PeerGangCasa({
      name: ":remote-casa",
      localGang: {
         name: "home",
         findNamedObject: function() {
            return source;
         }
      },
      localCasa: { uName: ":local-casa", secureMode: false }
   }, null);

   peerGangCasa.serveClient(socket);
   socket.listeners["subscribe-source"]({ sourceName: ":building" });
   socket.listeners["subscribe-source"]({ sourceName: ":building", property: "gate-open", event: "fault" });
   socket.listeners["unsubscribe-source"]({ sourceName: ":building" });

   assert.strictEqual(source.bound.length, 0);
   assert.strictEqual(source.removed.length, 0);
});

runTest("PeerGangCasa disconnect forces all local subscriptions to be removed", function() {
   var socket = createSocket();
   var source = createSource();
   var peerGangCasa = new PeerGangCasa({
      name: ":remote-casa",
      localGang: {
         name: "home",
         findNamedObject: function() {
            return source;
         }
      },
      localCasa: { uName: ":local-casa", secureMode: false }
   }, null);
   var data = { sourceName: ":building", property: "gate-open" };

   peerGangCasa.serveClient(socket);
   socket.listeners["subscribe-source"](data);
   socket.listeners["subscribe-source"](data);
   peerGangCasa.disconnect({ reason: "test" });

   assert.strictEqual(socket.disconnected, true);
   assert.strictEqual(source.removed.length, 1);
   assert.strictEqual(peerGangCasa.localSubscriptions.hasOwnProperty(":building:property:gate-open"), false);
   assert.strictEqual(peerGangCasa.state, "unavailable");
});

runTest("PeerGangCasa publishes only matching property updates", function() {
   var socket = createSocket();
   var source = createSource();
   var peerGangCasa = new PeerGangCasa({
      name: ":remote-casa",
      localGang: {
         name: "home",
         findNamedObject: function() {
            return source;
         }
      },
      localCasa: { uName: ":local-casa", secureMode: false }
   }, null);

   peerGangCasa.serveClient(socket);
   socket.listeners["subscribe-source"]({ sourceName: ":building", property: "gate-open" });

   source.bound[0].handler({ sourceName: ":building", name: "other", value: true });
   source.bound[0].handler({ sourceName: ":building", name: "gate-open", value: false });

   assert.strictEqual(socket.emitted.length, 2);
   assert.strictEqual(socket.emitted[1].message, "source-property-changed");
   assert.strictEqual(socket.emitted[1].data.value, false);
});

runTest("PeerGangCasa publishes only matching event updates", function() {
   var socket = createSocket();
   var source = createSource();
   var peerGangCasa = new PeerGangCasa({
      name: ":remote-casa",
      localGang: {
         name: "home",
         findNamedObject: function() {
            return source;
         }
      },
      localCasa: { uName: ":local-casa", secureMode: false }
   }, null);

   peerGangCasa.serveClient(socket);
   socket.listeners["subscribe-source"]({ sourceName: ":building", event: "fault" });

   source.bound[0].handler({ sourceName: ":building", name: "other" });
   source.bound[0].handler({ sourceName: ":building", name: "fault", value: true });

   assert.strictEqual(socket.emitted.length, 1);
   assert.strictEqual(socket.emitted[0].message, "source-event-raised");
   assert.deepStrictEqual(socket.emitted[0].data, { sourceName: ":building", name: "fault", value: true });
});

runTest("PeerGangCasa forwards incoming source updates to its PeerGang", function() {
   var socket = createSocket();
   var received = [];
   var peerGang = {
      addPeerGangCasa: function() {},
      superType: function() {
         return "peergang";
      },
      gangName: "farm-gate",
      sourcePropertyChanged: function(_data) {
         received.push(_data);
      }
   };
   var peerGangCasa = new PeerGangCasa({
      name: ":remote-casa",
      localGang: { name: "home" },
      localCasa: { uName: ":local-casa", secureMode: false }
   }, peerGang);

   peerGangCasa.establishSocket(socket);
   socket.listeners["source-property-changed"]({ sourceName: ":building", name: "gate-open", value: true });

   assert.strictEqual(received.length, 1);
   assert.strictEqual(received[0].sourceName, ":building");
});

runTest("PeerGang exact source lookup uses sparse source index before tree lookup", function() {
   var peerGang = new PeerGang({ name: "farm-gate" }, { name: "home" });
   var source = { uName: ":building:deep:sensor" };

   peerGang.addSource(source);

   assert.strictEqual(peerGang.findNamedObject(":building:deep:sensor"), source);
});

runTest("PeerGang creates fill-in tree nodes and can replace them with subscribed sources", function() {
   var peerGang = new PeerGang({ name: "farm-gate" }, { name: "home", casa: {} });
   var childSource = peerGang.findOrCreateSource(":building:deep:sensor");
   var buildingFillIn = peerGang.myNamedObjects.building;

   assert.ok(buildingFillIn);
   assert.strictEqual(buildingFillIn.type, "namedobject");
   assert.strictEqual(childSource.uName, ":building:deep:sensor");
   assert.strictEqual(peerGang.findNamedObject(":building:deep:sensor"), childSource);

   var buildingSource = peerGang.findOrCreateSource(":building");

   assert.strictEqual(buildingSource.uName, ":building");
   assert.strictEqual(peerGang.findNamedObject(":building"), buildingSource);
   assert.strictEqual(peerGang.findNamedObject(":building:deep:sensor"), childSource);
});

runTest("PeerGangCasa keeps remote writes disabled by default", function() {
   var peerGangCasa = new PeerGangCasa({
      name: ":remote-casa",
      localGang: { name: "home" },
      localCasa: { uName: ":local-casa", secureMode: false }
   }, null);

   peerGangCasa.connected = true;

   assert.strictEqual(peerGangCasa.setSourceProperty({ uName: ":building" }, "gate-open", true, { transaction: 1 }), false);
});

process.stdout.write("All peergangcasa tests passed.\n");
