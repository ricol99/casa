var assert = require('assert');
var CasaDiscoveryService = require('../services/casadiscoveryservice');
var PeerGang = require('../peergang');
var PeerGangCasa = require('../peergangcasa');
var PeerGangSource = require('../peergangsource');
var PeerSocketSession = require('../peersocketsession');
var PeerSourceCommandProtocol = require('../peersourcecommandprotocol');
var PeerSourceSubscriptionProtocol = require('../peersourcesubscriptionprotocol');
var PusherService = require('../services/pusherservice');
var WhRelayService = require('../services/whrelayservice');

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

function assertPrototypeMethods(_name, _prototype, _methods) {

   for (var i = 0; i < _methods.length; ++i) {
      assert.strictEqual(typeof _prototype[_methods[i]], "function", _name + "." + _methods[i]);
   }
}

runTest("PeerGang architecture primitives keep expected prototype method shape", function() {
   assertPrototypeMethods("CasaDiscoveryService", CasaDiscoveryService.prototype, [
      "discoverSourceOwner",
      "sourceOwnerStatusUpdate",
      "canServeSourceOwnerRequest",
      "gangCasaStatusUpdate",
      "registerSourceOwnerRoute",
      "sourceOwnerHttpRequestCb"
   ]);

   assertPrototypeMethods("MdnsDiscoveryTransport", CasaDiscoveryService.__testExports.MdnsDiscoveryTransport.prototype, [
      "discoverSourceOwner",
      "serviceUp",
      "serviceDown",
      "querySourceOwnerCandidate",
      "sourceOwnerHttpResponse"
   ]);

   assertPrototypeMethods("PusherMessageTransport", PusherService.__testExports.PusherMessageTransport.prototype, [
      "localPeerAddress",
      "normaliseOutgoingPeerAddress",
      "sendMessage"
   ]);

   assertPrototypeMethods("WhRelayService", WhRelayService.prototype, [
      "startTransports",
      "processTransportWebhook",
      "createWhRelayMessageId",
      "hasSeenWhRelayMessage",
      "sendTransportMessage"
   ]);

   assertPrototypeMethods("WhRelayMessageTransport", WhRelayService.__testExports.WhRelayMessageTransport.prototype, [
      "start",
      "localPeerAddress",
      "normaliseOutgoingPeerAddress",
      "sendMessage",
      "receivedWhRelayTransportMessage"
   ]);

   assertPrototypeMethods("WhRelayDiscoveryTransport", WhRelayService.__testExports.WhRelayDiscoveryTransport.prototype, [
      "start",
      "localPeerAddress",
      "sendDiscoveryMessage",
      "receivedWhRelayDiscoveryMessage",
      "discoverSourceOwner",
      "sendStatusUpdate",
      "startSearching",
      "startBroadcasting"
   ]);

   assertPrototypeMethods("PeerGang", PeerGang.prototype, [
      "subscribeSourceListener",
      "unsubscribeSourceListener",
      "sourceOwnerDiscovered",
      "resubscribeSourceListeners",
      "gangCasaUpCb",
      "gangCasaDownCb",
      "peerGangCasaUnavailableCb",
      "peerGangCasaLoginRejectedCb"
   ]);

   assertPrototypeMethods("PeerGangCasa", PeerGangCasa.prototype, [
      "connect",
      "disconnect",
      "serveClient",
      "isConnecting",
      "validSourceSubscriptionData",
      "socketSubscribeSourceCb",
      "socketUnsubscribeSourceCb",
      "addLocalPropertySubscription",
      "addLocalEventSubscription"
   ]);

   assertPrototypeMethods("PeerGangSource", PeerGangSource.prototype, [
      "sourceHasChangedProperty",
      "sourceHasRaisedEvent",
      "setProperty",
      "raiseEvent"
   ]);

   assertPrototypeMethods("PeerSocketSession", PeerSocketSession.prototype, [
      "setSocket",
      "addHandler",
      "establishListeners",
      "removeListeners",
      "establishHeartbeat",
      "stopHeartbeat"
   ]);

   assertPrototypeMethods("PeerSourceCommandProtocol", PeerSourceCommandProtocol.prototype, [
      "sendSetSourceProperty",
      "sendSetSourcePropertyWithRamp",
      "sendRaiseSourceEvent",
      "completeResponse"
   ]);

   assertPrototypeMethods("PeerSourceSubscriptionProtocol", PeerSourceSubscriptionProtocol.prototype, [
      "subscribeSource",
      "unsubscribeSource",
      "publishSourcePropertyChanged",
      "publishSourceEventRaised",
      "publishSourceInvalid"
   ]);
});

process.stdout.write("All peergang architecture guard tests passed.\n");
