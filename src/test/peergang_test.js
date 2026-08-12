var assert = require('assert');
var NamedObject = require('../namedobject');
var PeerGang = require('../peergang');

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

function runAsyncTest(_name, _fn) {
   _fn(function(_err) {

      if (_err) {
         process.stderr.write("[FAIL] " + _name + "\n");
         process.stderr.write((_err && _err.stack) ? _err.stack : (_err + "\n"));
         process.exit(1);
      }

      process.stdout.write("[PASS] " + _name + "\n");
   });
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

runTest("PeerGang owns an independent remote root namespace", function() {
   var localGang = { name: "home" };
   var peerGang = new PeerGang({ name: "farm-gate" }, localGang);
   var building = new NamedObject({ name: "building", type: "namedobject" }, peerGang);

   assert.strictEqual(peerGang.gangName, "farm-gate");
   assert.strictEqual(peerGang.uName, ":");
   assert.strictEqual(building.uName, ":building");
   assert.strictEqual(peerGang.findNamedObject(":building"), building);
});

runTest("PeerGang tracks source listener subscriptions by source event name", function() {
   var peerGang = new PeerGang({ name: "farm-gate" }, { name: "home" });
   var listener = {
      sourceEventName: "farm-gate::building:gate-open",
      sourceName: ":building",
      refreshSourceCalls: 0,
      refreshSource: function() {
         this.refreshSourceCalls = this.refreshSourceCalls + 1;
      }
   };

   assert.strictEqual(peerGang.subscribeSourceListener(listener), null);
   assert.strictEqual(peerGang.sourceListeners[listener.sourceEventName], listener);

   new NamedObject({ name: "building", type: "namedobject" }, peerGang);
   peerGang.refreshSourceListeners();

   assert.strictEqual(listener.refreshSourceCalls, 1);
   assert.strictEqual(peerGang.findNamedObject(":building").uName, ":building");

   peerGang.unsubscribeSourceListener(listener);
   assert.strictEqual(peerGang.sourceListeners.hasOwnProperty(listener.sourceEventName), false);
});

runTest("PeerGang discovers a source owner and connects PeerGangCasa to gang-casa address", function() {
   var socket = createSocket();
   var socketRequests = [];
   var discoveryRequests = [];
   var discoveryService = {
      discoverSourceOwner: function(_request, _callback) {
         discoveryRequests.push(_request);
         _callback(null, {
            casaName: ":barn-controller",
            address: "gang-casa://farm-gate/:barn-controller",
            messageTransportName: "pusher"
         });
      }
   };
   var localGang = {
      name: "home",
      casa: {
         uName: ":home-casa",
         secureMode: false,
         findServiceName: function(_type) {
            return _type === "casadiscoveryservice" ? "discovery" : null;
         },
         findService: function(_name) {
            return _name === "discovery" ? discoveryService : null;
         },
         mainWebService: {
            newIoSocket: function(_address, _route, _secure, _messageTransport) {
               socketRequests.push({
                  address: _address,
                  route: _route,
                  secure: _secure,
                  messageTransport: _messageTransport
               });
               return socket;
            }
         }
      }
   };
   var peerGang = new PeerGang({ name: "farm-gate" }, localGang);
   var listener = {
      sourceEventName: "farm-gate::building:gate-open",
      sourceName: ":building",
      eventName: "gate-open",
      listeningToPropertyChange: true,
      subscription: {}
   };

   peerGang.subscribeSourceListener(listener);

   assert.deepStrictEqual(discoveryRequests[0], {
      gang: "farm-gate",
      uName: ":building",
      property: "gate-open",
      event: undefined
   });
   assert.deepStrictEqual(socketRequests[0], {
      address: "gang-casa://farm-gate/:barn-controller",
      route: "/peergangcasa",
      secure: false,
      messageTransport: "pusher"
   });
   assert.strictEqual(peerGang.sourceOwners[":building"], ":barn-controller");
   assert.ok(peerGang.findPeerGangCasa(":barn-controller"));
});

runTest("PeerGang reuses a connecting PeerGangCasa for multiple source subscriptions", function() {
   var sockets = [];
   var socketRequests = [];
   var discoveryRequests = [];
   var discoveryService = {
      discoverSourceOwner: function(_request, _callback) {
         discoveryRequests.push(_request);
         _callback(null, {
            casaName: ":barn-controller",
            address: "gang-casa://farm-gate/:barn-controller",
            messageTransportName: "pusher"
         });
      }
   };
   var localGang = {
      name: "home",
      casa: {
         uName: ":home-casa",
         secureMode: false,
         findServiceName: function(_type) {
            return _type === "casadiscoveryservice" ? "discovery" : null;
         },
         findService: function(_name) {
            return _name === "discovery" ? discoveryService : null;
         },
         mainWebService: {
            newIoSocket: function(_address, _route, _secure, _messageTransport) {
               var socket = createSocket();

               sockets.push(socket);
               socketRequests.push({
                  address: _address,
                  route: _route,
                  secure: _secure,
                  messageTransport: _messageTransport
               });
               return socket;
            }
         }
      }
   };
   var peerGang = new PeerGang({ name: "farm-gate" }, localGang);
   var gateListener = {
      sourceEventName: "farm-gate::building:gate-open",
      sourceName: ":building",
      eventName: "gate-open",
      listeningToPropertyChange: true,
      subscription: { id: "gate" },
      refreshSource: function() {}
   };
   var yardListener = {
      sourceEventName: "farm-gate::yard:occupied",
      sourceName: ":yard",
      eventName: "occupied",
      listeningToPropertyChange: true,
      subscription: { id: "yard" },
      refreshSource: function() {}
   };
   var fieldListener = {
      sourceEventName: "farm-gate::field:occupied",
      sourceName: ":field",
      eventName: "occupied",
      listeningToPropertyChange: true,
      subscription: { id: "field" },
      refreshSource: function() {}
   };

   peerGang.subscribeSourceListener(gateListener);
   peerGang.subscribeSourceListener(yardListener);
   peerGang.sourceListeners[fieldListener.sourceEventName] = fieldListener;
   peerGang.sourceOwners[":field"] = ":field-controller";

   assert.strictEqual(discoveryRequests.length, 2);
   assert.strictEqual(socketRequests.length, 1);
   assert.strictEqual(peerGang.findPeerGangCasa(":barn-controller").isConnecting(), true);

   sockets[0].listeners.connect();
   sockets[0].listeners["peer-gang-login-ack"]({ casaName: ":barn-controller", gangName: "farm-gate" });

   assert.strictEqual(peerGang.findPeerGangCasa(":barn-controller").state, "connected");
   assert.strictEqual(sockets[0].emitted.length, 3);
   assert.strictEqual(sockets[0].emitted[0].message, "peer-gang-login");
   assert.deepStrictEqual(sockets[0].emitted[1], {
      message: "subscribe-source",
      data: {
         sourceName: ":building",
         property: "gate-open",
         subscription: { id: "gate" }
      }
   });
   assert.deepStrictEqual(sockets[0].emitted[2], {
      message: "subscribe-source",
      data: {
         sourceName: ":yard",
         property: "occupied",
         subscription: { id: "yard" }
      }
   });

   peerGang.findPeerGangCasa(":barn-controller").session.stopHeartbeat();
});

runAsyncTest("PeerGang rediscovers source owner when serving PeerGangCasa disconnects", function(_done) {
   var sockets = [];
   var socketRequests = [];
   var discoveryRequests = [];
   var discoveryResponses = [
      {
         casaName: ":barn-controller",
         address: "gang-casa://farm-gate/:barn-controller",
         messageTransportName: "pusher"
      },
      {
         casaName: ":field-controller",
         address: "gang-casa://farm-gate/:field-controller",
         messageTransportName: "pusher"
      }
   ];
   var discoveryService = {
      discoverSourceOwner: function(_request, _callback) {
         discoveryRequests.push(_request);
         _callback(null, discoveryResponses.shift());
      }
   };
   var localGang = {
      name: "home",
      casa: {
         uName: ":home-casa",
         secureMode: false,
         findServiceName: function(_type) {
            return _type === "casadiscoveryservice" ? "discovery" : null;
         },
         findService: function(_name) {
            return _name === "discovery" ? discoveryService : null;
         },
         mainWebService: {
            newIoSocket: function(_address, _route, _secure, _messageTransport) {
               var socket = createSocket();

               sockets.push(socket);
               socketRequests.push({
                  address: _address,
                  route: _route,
                  secure: _secure,
                  messageTransport: _messageTransport
               });
               return socket;
            }
         }
      }
   };
   var peerGang = new PeerGang({ name: "farm-gate" }, localGang);
   var invalidated = [];
   var listener = {
      sourceEventName: "farm-gate::building:gate-open",
      sourceName: ":building",
      eventName: "gate-open",
      listeningToPropertyChange: true,
      subscription: {},
      refreshSource: function() {}
   };
   var unaffectedListener = {
      sourceEventName: "farm-gate::other:occupied",
      sourceName: ":other",
      eventName: "occupied",
      listeningToPropertyChange: true,
      subscription: {},
      refreshSource: function() {}
   };

   peerGang.subscribeSourceListener(listener);
   peerGang.addSource({
      uName: ":building",
      invalidate: function(_includeChildren) {
         invalidated.push({ sourceName: this.uName, includeChildren: _includeChildren });
      }
   });
   peerGang.sourceListeners[unaffectedListener.sourceEventName] = unaffectedListener;
   peerGang.sourceOwners[":other"] = ":other-controller";

   assert.strictEqual(discoveryRequests.length, 1);
   assert.strictEqual(socketRequests[0].address, "gang-casa://farm-gate/:barn-controller");
   assert.ok(peerGang.findPeerGangCasa(":barn-controller"));

   sockets[0].listeners.disconnect({ reason: "lost" });

   setTimeout(function() {

      try {
         assert.strictEqual(peerGang.findPeerGangCasa(":barn-controller"), undefined);
         assert.deepStrictEqual(invalidated, [{ sourceName: ":building", includeChildren: false }]);
         assert.strictEqual(peerGang.sourceOwners[":other"], ":other-controller");
         assert.strictEqual(discoveryRequests.length, 2);
         assert.strictEqual(discoveryRequests[1].uName, ":building");
         assert.strictEqual(socketRequests[1].address, "gang-casa://farm-gate/:field-controller");
         assert.strictEqual(peerGang.sourceOwners[":building"], ":field-controller");
         assert.ok(peerGang.findPeerGangCasa(":field-controller"));
      }
      catch (_err) {
         return _done(_err);
      }

      _done();
   }, 10);
});

runTest("PeerGang treats gang-casa-down as early PeerGangCasa unavailability", function() {
   var sockets = [];
   var socketRequests = [];
   var discoveryRequests = [];
   var discoveryHandlers = {};
   var discoveryResponses = [
      {
         casaName: ":barn-controller",
         address: "gang-casa://farm-gate/:barn-controller",
         messageTransportName: "pusher"
      },
      {
         casaName: ":field-controller",
         address: "gang-casa://farm-gate/:field-controller",
         messageTransportName: "pusher"
      }
   ];
   var discoveryService = {
      on: function(_eventName, _handler) {
         discoveryHandlers[_eventName] = _handler;
      },
      discoverSourceOwner: function(_request, _callback) {
         discoveryRequests.push(_request);
         _callback(null, discoveryResponses.shift());
      }
   };
   var localGang = {
      name: "home",
      casa: {
         uName: ":home-casa",
         secureMode: false,
         findServiceName: function(_type) {
            return _type === "casadiscoveryservice" ? "discovery" : null;
         },
         findService: function(_name) {
            return _name === "discovery" ? discoveryService : null;
         },
         mainWebService: {
            newIoSocket: function(_address, _route, _secure, _messageTransport) {
               var socket = createSocket();

               sockets.push(socket);
               socketRequests.push({
                  address: _address,
                  route: _route,
                  secure: _secure,
                  messageTransport: _messageTransport
               });
               return socket;
            }
         }
      }
   };
   var peerGang = new PeerGang({ name: "farm-gate" }, localGang);
   var invalidated = [];
   var listener = {
      sourceEventName: "farm-gate::building:gate-open",
      sourceName: ":building",
      eventName: "gate-open",
      listeningToPropertyChange: true,
      subscription: {},
      refreshSource: function() {}
   };
   var unaffectedListener = {
      sourceEventName: "farm-gate::other:occupied",
      sourceName: ":other",
      eventName: "occupied",
      listeningToPropertyChange: true,
      subscription: {},
      refreshSource: function() {}
   };

   peerGang.subscribeSourceListener(listener);
   peerGang.addSource({
      uName: ":building",
      invalidate: function(_includeChildren) {
         invalidated.push({ sourceName: this.uName, includeChildren: _includeChildren });
      }
   });
   peerGang.sourceListeners[unaffectedListener.sourceEventName] = unaffectedListener;
   peerGang.sourceOwners[":other"] = ":other-controller";

   assert.strictEqual(discoveryRequests.length, 1);
   assert.ok(peerGang.findPeerGangCasa(":barn-controller"));

   discoveryHandlers["gang-casa-down"]({ gang: "other-gang", casaName: ":barn-controller" });

   assert.ok(peerGang.findPeerGangCasa(":barn-controller"));
   assert.strictEqual(discoveryRequests.length, 1);

   discoveryHandlers["gang-casa-down"]({ gang: "farm-gate", casaName: ":barn-controller" });

   assert.strictEqual(peerGang.findPeerGangCasa(":barn-controller"), undefined);
   assert.strictEqual(sockets[0].disconnected, true);
   assert.deepStrictEqual(invalidated, [{ sourceName: ":building", includeChildren: false }]);
   assert.strictEqual(peerGang.sourceOwners[":other"], ":other-controller");
   assert.strictEqual(discoveryRequests.length, 2);
   assert.strictEqual(socketRequests[1].address, "gang-casa://farm-gate/:field-controller");
   assert.strictEqual(peerGang.sourceOwners[":building"], ":field-controller");

   sockets[0].listeners.disconnect({ reason: "late socket disconnect" });

   assert.deepStrictEqual(invalidated, [{ sourceName: ":building", includeChildren: false }]);
   assert.strictEqual(discoveryRequests.length, 2);
});

runAsyncTest("PeerGang treats hard login rejection as terminal for the discovered PeerGangCasa", function(_done) {
   var socketRequests = [];
   var discoveryRequests = [];
   var discoveryService = {
      discoverSourceOwner: function(_request, _callback) {
         discoveryRequests.push(_request);
         _callback(null, {
            casaName: ":barn-controller",
            address: "gang-casa://farm-gate/:barn-controller",
            messageTransportName: "pusher"
         });
      }
   };
   var localGang = {
      name: "home",
      casa: {
         uName: ":home-casa",
         secureMode: false,
         findServiceName: function(_type) {
            return _type === "casadiscoveryservice" ? "discovery" : null;
         },
         findService: function(_name) {
            return _name === "discovery" ? discoveryService : null;
         },
         mainWebService: {
            newIoSocket: function(_address, _route, _secure, _messageTransport) {
               var socket = createSocket();

               socketRequests.push({
                  address: _address,
                  socket: socket
               });
               return socket;
            }
         }
      }
   };
   var peerGang = new PeerGang({ name: "farm-gate" }, localGang);
   var invalidated = [];
   var listener = {
      sourceEventName: "farm-gate::building:gate-open",
      sourceName: ":building",
      eventName: "gate-open",
      listeningToPropertyChange: true,
      subscription: {},
      refreshSource: function() {}
   };

   peerGang.subscribeSourceListener(listener);
   peerGang.addSource({
      uName: ":building",
      invalidate: function(_includeChildren) {
         invalidated.push({ sourceName: this.uName, includeChildren: _includeChildren });
      }
   });

   peerGang.findPeerGangCasa(":barn-controller").socketPeerGangLoginRejectCb({ reason: "wrong-gang" });

   setTimeout(function() {

      try {
         assert.strictEqual(peerGang.findPeerGangCasa(":barn-controller"), undefined);
         assert.deepStrictEqual(invalidated, [{ sourceName: ":building", includeChildren: false }]);
         assert.strictEqual(peerGang.sourceOwners.hasOwnProperty(":building"), false);
         assert.strictEqual(discoveryRequests.length, 1);
         assert.strictEqual(socketRequests.length, 1);
      }
      catch (_err) {
         return _done(_err);
      }

      _done();
   }, 10);
});

runTest("PeerGang retries unresolved source owner discovery when remote gang-casa comes up", function() {
   var socketRequests = [];
   var discoveryRequests = [];
   var discoveryHandlers = {};
   var discoveryResponses = [
      { err: new Error("source owner discovery timed out") },
      {
         data: {
            casaName: ":barn-controller",
            address: "gang-casa://farm-gate/:barn-controller",
            messageTransportName: "pusher"
         }
      }
   ];
   var discoveryService = {
      on: function(_eventName, _handler) {
         discoveryHandlers[_eventName] = _handler;
      },
      discoverSourceOwner: function(_request, _callback) {
         var response = discoveryResponses.shift();

         discoveryRequests.push(_request);
         _callback(response.err || null, response.data);
      }
   };
   var localGang = {
      name: "home",
      casa: {
         uName: ":home-casa",
         secureMode: false,
         findServiceName: function(_type) {
            return _type === "casadiscoveryservice" ? "discovery" : null;
         },
         findService: function(_name) {
            return _name === "discovery" ? discoveryService : null;
         },
         mainWebService: {
            newIoSocket: function(_address, _route, _secure, _messageTransport) {
               socketRequests.push({
                  address: _address,
                  route: _route,
                  secure: _secure,
                  messageTransport: _messageTransport
               });
               return createSocket();
            }
         }
      }
   };
   var peerGang = new PeerGang({ name: "farm-gate" }, localGang);
   var listener = {
      sourceEventName: "farm-gate::building:gate-open",
      sourceName: ":building",
      eventName: "gate-open",
      listeningToPropertyChange: true,
      subscription: {},
      refreshSource: function() {}
   };

   peerGang.subscribeSourceListener(listener);

   assert.strictEqual(discoveryRequests.length, 1);
   assert.strictEqual(peerGang.sourceOwnerRetryRequired[listener.sourceEventName], true);

   discoveryHandlers["gang-casa-up"]({ gang: "other-gang", casaName: ":other-casa" });
   assert.strictEqual(discoveryRequests.length, 1);

   discoveryHandlers["gang-casa-up"]({ gang: "farm-gate", casaName: ":barn-controller" });

   assert.strictEqual(discoveryRequests.length, 2);
   assert.strictEqual(peerGang.sourceOwnerRetryRequired.hasOwnProperty(listener.sourceEventName), false);
   assert.strictEqual(socketRequests[0].address, "gang-casa://farm-gate/:barn-controller");
   assert.strictEqual(peerGang.sourceOwners[":building"], ":barn-controller");
});

runAsyncTest("PeerGang resubscribes after PeerGangCasa login and delivers remote property updates", function(_done) {
   var socket = createSocket();
   var receivedPropertyChanges = [];
   var discoveryService = {
      discoverSourceOwner: function(_request, _callback) {
         _callback(null, {
            casaName: ":barn-controller",
            address: "gang-casa://farm-gate/:barn-controller",
            messageTransportName: "pusher"
         });
      }
   };
   var localGang = {
      name: "home",
      scheduleRefreshSourceListeners: function() {},
      casa: {
         uName: ":home-casa",
         secureMode: false,
         findServiceName: function(_type) {
            return _type === "casadiscoveryservice" ? "discovery" : null;
         },
         findService: function(_name) {
            return _name === "discovery" ? discoveryService : null;
         },
         mainWebService: {
            newIoSocket: function() {
               return socket;
            }
         }
      }
   };
   var peerGang = new PeerGang({ name: "farm-gate" }, localGang);
   var listener = {
      sourceEventName: "farm-gate::building:gate-open",
      sourceName: ":building",
      eventName: "gate-open",
      listeningToPropertyChange: true,
      subscription: { gang: "farm-gate" },
      refreshSource: function() {
         var source = peerGang.findNamedObject(this.sourceName);

         if (source && !this.bound) {
            this.bound = true;
            source.on("property-changed", function(_data) {
               receivedPropertyChanges.push(_data);

               try {
                  assert.strictEqual(_data.sourceName, ":building");
                  assert.strictEqual(_data.name, "gate-open");
                  assert.strictEqual(_data.value, true);
                  assert.strictEqual(_data.valueType, "boolean");
                  peerGang.findPeerGangCasa(":barn-controller").session.stopHeartbeat();
               }
               catch (_err) {
                  return _done(_err);
               }

               _done();
            });
         }
      }
   };

   peerGang.subscribeSourceListener(listener);

   assert.strictEqual(socket.emitted.length, 0);

   socket.listeners.connect();
   assert.strictEqual(socket.emitted[0].message, "peer-gang-login");

   socket.listeners["peer-gang-login-ack"]({ casaName: ":barn-controller", gangName: "farm-gate" });
   assert.strictEqual(socket.emitted[1].message, "subscribe-source");
   assert.deepStrictEqual(socket.emitted[1].data, {
      sourceName: ":building",
      property: "gate-open",
      subscription: { gang: "farm-gate" }
   });

   socket.listeners["source-property-changed"]({
      sourceName: ":building",
      name: "gate-open",
      value: true,
      valueType: "boolean"
   });

   var source = peerGang.findNamedObject(":building");

   assert.ok(source);
   assert.ok(source.properties["gate-open"]);
});

runAsyncTest("PeerGang resubscribes after PeerGangCasa login and delivers remote events", function(_done) {
   var socket = createSocket();
   var discoveryService = {
      discoverSourceOwner: function(_request, _callback) {
         _callback(null, {
            casaName: ":barn-controller",
            address: "gang-casa://farm-gate/:barn-controller",
            messageTransportName: "pusher"
         });
      }
   };
   var localGang = {
      name: "home",
      scheduleRefreshSourceListeners: function() {},
      casa: {
         uName: ":home-casa",
         secureMode: false,
         findServiceName: function(_type) {
            return _type === "casadiscoveryservice" ? "discovery" : null;
         },
         findService: function(_name) {
            return _name === "discovery" ? discoveryService : null;
         },
         mainWebService: {
            newIoSocket: function() {
               return socket;
            }
         }
      }
   };
   var peerGang = new PeerGang({ name: "farm-gate" }, localGang);
   var listener = {
      sourceEventName: "farm-gate::building:fault",
      sourceName: ":building",
      eventName: "fault",
      listeningToPropertyChange: false,
      subscription: { gang: "farm-gate" },
      refreshSource: function() {
         var source = peerGang.findNamedObject(this.sourceName);

         if (source && !this.bound) {
            this.bound = true;
            source.on("event-raised", function(_data) {

               try {
                  assert.strictEqual(_data.sourceName, ":building");
                  assert.strictEqual(_data.name, "fault");
                  assert.strictEqual(_data.value, true);
                  peerGang.findPeerGangCasa(":barn-controller").session.stopHeartbeat();
               }
               catch (_err) {
                  return _done(_err);
               }

               _done();
            });
         }
      }
   };

   peerGang.subscribeSourceListener(listener);

   socket.listeners.connect();
   socket.listeners["peer-gang-login-ack"]({ casaName: ":barn-controller", gangName: "farm-gate" });
   assert.strictEqual(socket.emitted[1].message, "subscribe-source");
   assert.deepStrictEqual(socket.emitted[1].data, {
      sourceName: ":building",
      event: "fault",
      subscription: { gang: "farm-gate" }
   });

   socket.listeners["source-event-raised"]({
      sourceName: ":building",
      name: "fault",
      value: true
   });
});
