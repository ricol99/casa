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
   peerCasa.sources = {};
   peerCasa.emitted = [];
   peerCasa.emit = function(_event, _data) {
      this.emitted.push({ event: _event, data: _data });
   };
   peerCasa.updateSourceSubscriptionProtocol();

   return peerCasa;
}

runTest("PeerCasa publishes same-gang property and event updates through the subscription protocol", function() {
   var peerCasa = createPeerCasa();
   var propertyData = {
      sourceName: ":building",
      name: "gate-open",
      value: true
   };
   var eventData = {
      sourceName: ":building",
      name: "opened"
   };

   peerCasa.sourcePropertyChangedCasaCb(propertyData);
   peerCasa.sourceEventRaisedCasaCb(eventData);

   assert.deepStrictEqual(peerCasa.socket.emitted[0], {
      message: "source-property-changed",
      data: propertyData
   });
   assert.deepStrictEqual(peerCasa.socket.emitted[1], {
      message: "source-event-raised",
      data: eventData
   });
});

runTest("PeerCasa does not republish local from-peer or self-originating source updates", function() {
   var peerCasa = createPeerCasa();

   peerCasa.sourcePropertyChangedCasaCb({ sourceName: ":building", local: true });
   peerCasa.sourcePropertyChangedCasaCb({ sourceName: ":building", fromPeer: true });
   peerCasa.sourcePropertyChangedCasaCb({ sourceName: ":building", sourcePeerCasa: ":peer-casa" });
   peerCasa.sourceEventRaisedCasaCb({ sourceName: ":building", local: true });
   peerCasa.sourceEventRaisedCasaCb({ sourceName: ":building", fromPeer: true });
   peerCasa.sourceEventRaisedCasaCb({ sourceName: ":building", sourcePeerCasa: ":peer-casa" });

   assert.strictEqual(peerCasa.socket.emitted.length, 0);
});

runTest("PeerCasa publishes subscription and child-interest messages through the subscription protocol", function() {
   var peerCasa = createPeerCasa();
   var source = { uName: ":building" };
   var subscription = { property: "gate-open" };

   peerCasa.subscriptionRegistered(source, "property-changed", subscription);
   peerCasa.subscriptionRemoved(source, "property-changed", subscription);
   peerCasa.interestInNewChild(source, ":building:door");

   assert.deepStrictEqual(peerCasa.socket.emitted[0], {
      message: "source-subscription-registered",
      data: {
         sourceName: ":building",
         event: "property-changed",
         subscription: subscription
      }
   });
   assert.deepStrictEqual(peerCasa.socket.emitted[1], {
      message: "source-subscription-removed",
      data: {
         sourceName: ":building",
         event: "property-changed",
         subscription: subscription
      }
   });
   assert.deepStrictEqual(peerCasa.socket.emitted[2], {
      message: "source-interest-in-new-child",
      data: {
         sourceName: ":building",
         uName: ":building:door"
      }
   });
});

runTest("PeerCasa applies incoming remote property and event updates to peer sources", function() {
   var peerCasa = createPeerCasa();
   var propertyUpdates = [];
   var eventUpdates = [];

   peerCasa.sources[":building"] = {
      sourceHasChangedProperty: function(_data) {
         propertyUpdates.push(_data);
      },
      sourceHasRaisedEvent: function(_data) {
         eventUpdates.push(_data);
      }
   };

   peerCasa.socketSourcePropertyChangedCb({ sourceName: ":building", name: "gate-open", value: true });
   peerCasa.socketSourceEventRaisedCb({ sourceName: ":building", name: "opened" });

   assert.strictEqual(peerCasa.emitted[0].event, "source-property-changed");
   assert.strictEqual(peerCasa.emitted[1].event, "source-event-raised");
   assert.strictEqual(propertyUpdates.length, 1);
   assert.strictEqual(propertyUpdates[0].sourcePeerCasa, ":peer-casa");
   assert.strictEqual(eventUpdates.length, 1);
   assert.strictEqual(eventUpdates[0].sourcePeerCasa, ":peer-casa");
});

process.stdout.write("All peercasa subscription protocol tests passed.\n");
