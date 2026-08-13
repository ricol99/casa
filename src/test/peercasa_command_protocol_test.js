var assert = require('assert');
var PeerCasa = require('../peercasa');

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
      emit: function(_message, _data) {
         this.emitted.push({ message: _message, data: _data });
      }
   };
}

function createPeerCasa() {
   var peerCasa = Object.create(PeerCasa.prototype);

   peerCasa.uName = ":peer-casa";
   peerCasa.connected = true;
   peerCasa.socket = createSocket();
   peerCasa.incompleteRequests = {};
   peerCasa.reqId = 0;
   peerCasa.casa = {
      uName: ":local-casa"
   };
   peerCasa.forwardResponses = [];
   peerCasa.emit = function(_event, _data) {

      if (_event === "forward-response") {
         this.forwardResponses.push(_data);
      }
   };
   peerCasa.updateSourceCommandProtocol();

   return peerCasa;
}

function completeAllRequests(_peerCasa, _result) {

   for (var requestId in _peerCasa.incompleteRequests) {

      if (_peerCasa.incompleteRequests.hasOwnProperty(requestId)) {
         _peerCasa.incompleteRequests[requestId].completeRequest(_result);
         delete _peerCasa.incompleteRequests[requestId];
      }
   }
}

runTest("PeerCasa command requests preserve existing wire shape", function() {
   var peerCasa = createPeerCasa();
   var source = { uName: ":building" };

   assert.strictEqual(peerCasa.setSourceTransaction(source, "tx-2", { transaction: "tx-1" }), true);
   assert.strictEqual(peerCasa.setSourceProperty(source, "gate-open", true, { transaction: "tx-2" }), true);
   assert.strictEqual(peerCasa.setSourcePropertyWithRamp(source, "brightness", { target: 60 }, { transaction: "tx-3" }), true);
   assert.strictEqual(peerCasa.raiseSourceEvent(source, "open", { transaction: "tx-4" }), true);

   assert.deepStrictEqual(peerCasa.socket.emitted[0], {
      message: "set-source-transaction-req",
      data: {
         sourceName: ":building",
         newTransaction: "tx-2",
         transaction: "tx-1",
         requestId: ":peer-casa:settrans:0",
         requestor: ":local-casa",
         casaName: ":peer-casa"
      }
   });
   assert.deepStrictEqual(peerCasa.socket.emitted[1], {
      message: "set-source-property-req",
      data: {
         sourceName: ":building",
         property: "gate-open",
         value: true,
         transaction: "tx-2",
         requestId: ":peer-casa:changeprop:1",
         requestor: ":local-casa",
         casaName: ":peer-casa"
      }
   });
   assert.deepStrictEqual(peerCasa.socket.emitted[2], {
      message: "set-source-property-req",
      data: {
         sourceName: ":building",
         property: "brightness",
         ramp: { target: 60 },
         transaction: "tx-3",
         requestId: ":peer-casa:changeprop:2",
         requestor: ":local-casa",
         casaName: ":peer-casa"
      }
   });
   assert.deepStrictEqual(peerCasa.socket.emitted[3], {
      message: "raise-source-event-req",
      data: {
         sourceName: ":building",
         eventName: "open",
         transaction: "tx-4",
         requestId: ":peer-casa:raiseevent:3",
         requestor: ":local-casa",
         casaName: ":peer-casa"
      }
   });
   assert.strictEqual(peerCasa.reqId, 4);

   completeAllRequests(peerCasa, true);
});

runTest("PeerCasa command requests are not sent while disconnected", function() {
   var peerCasa = createPeerCasa();

   peerCasa.connected = false;

   assert.strictEqual(peerCasa.setSourceProperty({ uName: ":building" }, "gate-open", true, { transaction: "tx-1" }), false);
   assert.strictEqual(peerCasa.socket.emitted.length, 0);
   assert.deepStrictEqual(peerCasa.incompleteRequests, {});
});

runTest("PeerCasa command responses complete local requests", function() {
   var peerCasa = createPeerCasa();

   peerCasa.setSourceTransaction({ uName: ":building" }, "tx-2", { transaction: "tx-1" });
   peerCasa.setSourceProperty({ uName: ":building" }, "gate-open", true, { transaction: "tx-1" });
   peerCasa.raiseSourceEvent({ uName: ":building" }, "open", { transaction: "tx-1" });
   assert.ok(peerCasa.incompleteRequests[":peer-casa:settrans:0"]);
   assert.ok(peerCasa.incompleteRequests[":peer-casa:changeprop:1"]);
   assert.ok(peerCasa.incompleteRequests[":peer-casa:raiseevent:2"]);

   peerCasa.socketSetSourceTransactionRespCb({
      sourceName: ":building",
      requestId: ":peer-casa:settrans:0",
      requestor: ":local-casa",
      result: true
   });
   peerCasa.socketSetSourcePropertyRespCb({
      sourceName: ":building",
      requestId: ":peer-casa:changeprop:1",
      requestor: ":local-casa",
      result: true
   });
   peerCasa.socketRaiseSourceEventRespCb({
      sourceName: ":building",
      requestId: ":peer-casa:raiseevent:2",
      requestor: ":local-casa",
      result: true
   });

   assert.strictEqual(peerCasa.incompleteRequests.hasOwnProperty(":peer-casa:settrans:0"), false);
   assert.strictEqual(peerCasa.incompleteRequests.hasOwnProperty(":peer-casa:changeprop:1"), false);
   assert.strictEqual(peerCasa.incompleteRequests.hasOwnProperty(":peer-casa:raiseevent:2"), false);
});

runTest("PeerCasa command responses for other requestors are forwarded", function() {
   var peerCasa = createPeerCasa();
   var transactionResponse = {
      sourceName: ":building",
      requestId: ":other:settrans:0",
      requestor: ":other-casa",
      result: true
   };
   var propertyResponse = {
      sourceName: ":building",
      requestId: ":other:changeprop:0",
      requestor: ":other-casa",
      result: true
   };
   var eventResponse = {
      sourceName: ":building",
      requestId: ":other:raiseevent:0",
      requestor: ":other-casa",
      result: true
   };

   peerCasa.socketSetSourceTransactionRespCb(transactionResponse);
   peerCasa.socketSetSourcePropertyRespCb(propertyResponse);
   peerCasa.socketRaiseSourceEventRespCb(eventResponse);

   assert.deepStrictEqual(peerCasa.forwardResponses[0], {
      message: "set-source-transaction-resp",
      data: transactionResponse,
      sourceCasa: ":peer-casa"
   });
   assert.deepStrictEqual(peerCasa.forwardResponses[1], {
      message: "set-source-property-resp",
      data: propertyResponse,
      sourceCasa: ":peer-casa"
   });
   assert.deepStrictEqual(peerCasa.forwardResponses[2], {
      message: "raise-source-event-resp",
      data: eventResponse,
      sourceCasa: ":peer-casa"
   });
});

runTest("PeerCasa raise event requests reply after raising local source events", function() {
   var peerCasa = createPeerCasa();
   var raisedEvents = [];
   var source = {
      uName: ":building",
      raiseEvent: function(_eventName, _data) {
         raisedEvents.push({ eventName: _eventName, data: _data });
      }
   };

   peerCasa.gang = {
      findNamedObject: function(_uName) {
         assert.strictEqual(_uName, ":building");
         return source;
      }
   };

   peerCasa.socketRaiseSourceEventReqCb({
      sourceName: ":building",
      eventName: "open",
      requestId: ":other:raiseevent:0",
      requestor: ":other-casa",
      transaction: "tx-1"
   });

   assert.strictEqual(raisedEvents.length, 1);
   assert.strictEqual(raisedEvents[0].eventName, "open");
   assert.deepStrictEqual(peerCasa.socket.emitted[0], {
      message: "raise-source-event-resp",
      data: {
         sourceName: ":building",
         requestId: ":other:raiseevent:0",
         result: true,
         eventName: "open",
         requestor: ":other-casa"
      }
   });
});

process.stdout.write("All peercasa command protocol tests passed.\n");
