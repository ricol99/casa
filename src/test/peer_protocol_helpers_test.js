var assert = require('assert');
var PeerSocketRequestor = require('../peersocketrequestor');
var PeerSourceCommandProtocol = require('../peersourcecommandprotocol');
var PeerSourceSubscriptionProtocol = require('../peersourcesubscriptionprotocol');
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
      emitted: [],
      listeners: {},
      removed: [],
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

runTest("PeerSocketRequestor emits request and completes callback", function() {
   var socket = createSocket();
   var callbackArgs = null;
   var requestor = new PeerSocketRequestor({
      requestId: "req-1",
      socket: socket,
      callback: function(_err, _result) {
         callbackArgs = { err: _err, result: _result };
      }
   });

   requestor.sendRequest({ message: "do-thing", data: { requestId: "req-1" } }, function() {});

   assert.strictEqual(socket.emitted.length, 1);
   assert.strictEqual(socket.emitted[0].message, "do-thing");

   requestor.completeRequest(true);

   assert.deepStrictEqual(callbackArgs, { err: null, result: true });
});

runTest("PeerSourceCommandProtocol sends property request with shared wire shape", function() {
   var socket = createSocket();
   var incompleteRequests = {};
   var protocol = new PeerSourceCommandProtocol({
      socket: socket,
      incompleteRequests: incompleteRequests,
      requestPrefix: ":peer-gang-casa",
      requestor: ":local-casa"
   });

   assert.strictEqual(protocol.sendSetSourceProperty({ uName: ":building" }, "gate-open", true, { transaction: 12 }), true);

   assert.strictEqual(socket.emitted.length, 1);
   assert.strictEqual(socket.emitted[0].message, "set-source-property-req");
   assert.strictEqual(socket.emitted[0].data.sourceName, ":building");
   assert.strictEqual(socket.emitted[0].data.property, "gate-open");
   assert.strictEqual(socket.emitted[0].data.value, true);
   assert.strictEqual(socket.emitted[0].data.requestor, ":local-casa");
   assert.strictEqual(socket.emitted[0].data.transaction, 12);
   assert.ok(incompleteRequests[socket.emitted[0].data.requestId]);

   incompleteRequests[socket.emitted[0].data.requestId].completeRequest(true);
});

runTest("PeerSourceCommandProtocol completes matching response", function() {
   var socket = createSocket();
   var result = null;
   var protocol = new PeerSourceCommandProtocol({
      socket: socket,
      incompleteRequests: {},
      requestPrefix: ":peer-gang-casa",
      requestor: ":local-casa"
   });

   protocol.sendRaiseSourceEvent({ uName: ":building" }, "open", { transaction: 13 }, function(_err, _result) {
      assert.strictEqual(_err, null);
      result = _result;
   });

   var requestId = socket.emitted[0].data.requestId;

   assert.strictEqual(protocol.completeResponse({ requestId: requestId, requestor: ":local-casa", result: true }), true);
   assert.strictEqual(result, true);
   assert.strictEqual(protocol.incompleteRequests.hasOwnProperty(requestId), false);
   assert.strictEqual(protocol.completeResponse({ requestId: requestId, requestor: ":other-casa", result: true }), false);
});

runTest("PeerSourceSubscriptionProtocol sends subscription and update messages", function() {
   var socket = createSocket();
   var protocol = new PeerSourceSubscriptionProtocol({ socket: socket });

   protocol.subscribeSource(":building", { property: "gate-open", subscription: { gang: "farm-gate" } });
   protocol.publishSourcePropertyChanged({ sourceName: ":building", name: "gate-open", value: true });
   protocol.unsubscribeSource(":building", { property: "gate-open" });
   protocol.publishSourceSubscriptionRegistered({ sourceName: ":building", event: "property-changed", subscription: { property: "gate-open" } });
   protocol.publishSourceSubscriptionRemoved({ sourceName: ":building", event: "property-changed", subscription: { property: "gate-open" } });
   protocol.publishSourceInterestInNewChild({ sourceName: ":building", uName: ":building:door" });

   assert.strictEqual(socket.emitted[0].message, "subscribe-source");
   assert.deepStrictEqual(socket.emitted[0].data, {
      sourceName: ":building",
      property: "gate-open",
      subscription: { gang: "farm-gate" }
   });
   assert.strictEqual(socket.emitted[1].message, "source-property-changed");
   assert.strictEqual(socket.emitted[2].message, "unsubscribe-source");
   assert.strictEqual(socket.emitted[3].message, "source-subscription-registered");
   assert.strictEqual(socket.emitted[4].message, "source-subscription-removed");
   assert.strictEqual(socket.emitted[5].message, "source-interest-in-new-child");
});

runTest("PeerSocketSession registers and removes prototype-style handlers", function() {
   var socket = createSocket();
   var session = new PeerSocketSession({ socket: socket, heartbeatIntervalMs: 1000, heartbeatTimeoutMs: 2000 });
   var handler = function() {};

   session.addHandler("connect", handler);
   session.establishListeners();

   assert.strictEqual(socket.listeners.connect, handler);

   session.removeListeners();

   assert.strictEqual(socket.listeners.hasOwnProperty("connect"), false);
   assert.strictEqual(socket.removed[0].message, "connect");
   assert.strictEqual(socket.removed[0].handler, handler);
});

process.stdout.write("All peer protocol helper tests passed.\n");
