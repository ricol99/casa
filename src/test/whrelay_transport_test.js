var assert = require('assert');
var WhRelayService = require('../services/whrelayservice');

var pendingAsyncTests = 0;
var finishedSchedulingTests = false;

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
   pendingAsyncTests++;

   try {
      _fn(function(_err) {

         if (_err) {
            process.stderr.write("[FAIL] " + _name + "\n");
            process.stderr.write((_err && _err.stack) ? _err.stack : (_err + "\n"));
            process.exit(1);
         }

         process.stdout.write("[PASS] " + _name + "\n");
         pendingAsyncTests--;
         finishTests();
      });
   }
   catch (_err) {
      process.stderr.write("[FAIL] " + _name + "\n");
      process.stderr.write(_err.stack + "\n");
      process.exit(1);
   }
}

function finishTests() {

   if (finishedSchedulingTests && (pendingAsyncTests === 0)) {
      process.stdout.write("All whrelay transport tests passed.\n");
   }
}

function createOwner(_gangName, _casaUName, _sent) {
   var service = Object.create(WhRelayService.prototype);

   service.uName = ":whrelay-" + _gangName + "-" + _casaUName;
   service.apiSecret = "secret";
   service.whrelaySources = {};
   service.receivedWhRelayMessages = {};
   service.receivedWhRelayMessageTimeoutMs = 1000;
   service.nextWhRelayMessageId = 0;
   service.whrelayOriginId = _gangName + ":" + _casaUName + ":origin";
   service.sendMessage = function(_body, _callback) {
      _sent.push({ owner: service, body: _body });

      if (_callback) {
         _callback(null, true);
      }
   };
   service.gang = {
      name: _gangName,
      casa: {
         uName: _casaUName,
         name: _casaUName.replace(/^:/, ""),
         findServiceName: function() {
            return null;
         },
         findService: function() {
            return null;
         }
      },
      findNamedObject: function() {
         return null;
      }
   };

   return service;
}

function createMessageTransport(_gangName, _casaUName, _sent) {
   var fakeIoMessageSocketService = {
      addMessageTransport: function(_name, _transport) {
         this.transportName = _name;
         this.transport = _transport;
      }
   };
   var owner = createOwner(_gangName, _casaUName, _sent);
   var WhRelayMessageTransport = WhRelayService.__testExports.WhRelayMessageTransport;
   var transport = new WhRelayMessageTransport(owner, fakeIoMessageSocketService);

   owner.whRelayMessageTransport = transport;
   transport.start();

   return {
      ioMessageSocketService: fakeIoMessageSocketService,
      owner: owner,
      transport: transport
   };
}

function createDiscoveryTransport(_gangName, _casaUName, _sent) {
   var statusUpdates = [];
   var sourceOwnerResponses = [];
   var sourceMap = {};
   var owner = createOwner(_gangName, _casaUName, _sent);

   owner.casaDiscoveryService = {
      addDiscoveryTransport: function(_name, _transport) {
         this.transportName = _name;
         this.transport = _transport;
      },
      gangCasaStatusUpdate: function(_gang, _name, _status, _address, _discoveryTransportName, _messageTransportName, _tier) {
         statusUpdates.push({
            gang: _gang,
            name: _name,
            status: _status,
            address: _address,
            discoveryTransportName: _discoveryTransportName,
            messageTransportName: _messageTransportName,
            tier: _tier
         });
      },
      sourceOwnerStatusUpdate: function(_data, _discoveryTransportName, _messageTransportName, _tier) {
         sourceOwnerResponses.push({
            data: _data,
            discoveryTransportName: _discoveryTransportName,
            messageTransportName: _messageTransportName,
            tier: _tier
         });
      },
      canServeSourceOwnerRequest: function(_data) {
         var source = sourceMap[_data.uName];

         return !!(source && (source.casa === owner.gang.casa) &&
                   (!_data.property || source.hasProperty(_data.property)) &&
                   (!_data.event || (source.events && source.events.hasOwnProperty(_data.event))));
      }
   };
   owner.gang.findNamedObject = function(_uName) {
      return sourceMap[_uName] || null;
   };

   var WhRelayDiscoveryTransport = WhRelayService.__testExports.WhRelayDiscoveryTransport;
   var transport = new WhRelayDiscoveryTransport(owner, "whrelay", owner.casaDiscoveryService, "whrelay", 3);

   owner.whRelayDiscoveryTransport = transport;
   transport.start();

   return {
      owner: owner,
      sourceMap: sourceMap,
      sourceOwnerResponses: sourceOwnerResponses,
      statusUpdates: statusUpdates,
      transport: transport
   };
}

function deliver(_receiver, _body) {
   _receiver.owner.processWebhook(JSON.parse(JSON.stringify(_body)));
}

runTest("whrelay message transport registers as an IoMessageSocket transport", function() {
   var sent = [];
   var harness = createMessageTransport("farm-gate", ":barn-controller", sent);

   assert.strictEqual(harness.ioMessageSocketService.transportName, "whrelay");
   assert.strictEqual(harness.ioMessageSocketService.transport, harness.transport);
});

runAsyncTest("whrelay message transport routes gang-casa socket envelopes", function(_done) {
   var sent = [];
   var sender = createMessageTransport("main-house", ":home-controller", sent);
   var receiver = createMessageTransport("farm-gate", ":barn-controller", sent);
   var envelope = {
      id: "socket-1",
      route: "/peergangcasa",
      peerAddress: sender.owner.gang.casa.uName,
      destAddress: receiver.transport.localPeerAddress(),
      messageData: {
         config: { heartbeat: 0 }
      }
   };

   receiver.transport.on("connect", function(_data) {

      try {
         assert.strictEqual(_data.id, "socket-1");
         assert.strictEqual(_data.route, "/peergangcasa");
         assert.strictEqual(_data.peerAddress, sender.transport.localPeerAddress());
         assert.strictEqual(_data.destAddress, receiver.transport.localPeerAddress());
      }
      catch (_err) {
         return _done(_err);
      }

      _done();
   });

   sender.transport.sendMessage("connect", envelope);

   assert.strictEqual(sent.length, 1);
   assert.strictEqual(sent[0].body.__casaWhRelayTransport, true);
   assert.strictEqual(sent[0].body.whrelayKind, "message");
   assert.strictEqual(sent[0].body.message, "connect");
   assert.strictEqual(sent[0].body.peerAddress, sender.transport.localPeerAddress());

   deliver(receiver, sent[0].body);
});

runAsyncTest("whrelay message transport routes replies to normalized requester addresses", function(_done) {
   var sent = [];
   var requester = createMessageTransport("main-house", ":home-controller", sent);
   var responder = createMessageTransport("farm-gate", ":barn-controller", sent);

   requester.transport.on("connect-response", function(_data) {

      try {
         assert.strictEqual(_data.id, "socket-1");
         assert.strictEqual(_data.peerAddress, responder.transport.localPeerAddress());
         assert.strictEqual(_data.destAddress, requester.transport.localPeerAddress());
         assert.deepStrictEqual(_data.messageData, { accept: true });
      }
      catch (_err) {
         return _done(_err);
      }

      _done();
   });

   responder.transport.sendMessage("connect-response", {
      id: "socket-1",
      route: "/peergangcasa",
      peerAddress: responder.owner.gang.casa.uName,
      destAddress: requester.transport.localPeerAddress(),
      messageData: {
         accept: true
      }
   });

   assert.strictEqual(sent.length, 1);
   assert.strictEqual(sent[0].body.peerAddress, responder.transport.localPeerAddress());
   assert.strictEqual(sent[0].body.destAddress, requester.transport.localPeerAddress());

   deliver(requester, sent[0].body);
});

runTest("whrelay ignores self transport messages and preserves existing source routing", function() {
   var sent = [];
   var harness = createMessageTransport("farm-gate", ":barn-controller", sent);
   var propertyMessages = [];

   harness.owner.registerSource(":building", {
      newPropertyChangeReceived: function(_body) {
         propertyMessages.push(_body);
      }
   });

   harness.owner.processWebhook({
      __casaWhRelayTransport: true,
      whrelayKind: "message",
      whrelayOriginId: harness.owner.whrelayOriginId,
      whrelayMessageId: "self-1",
      destAddress: harness.transport.localPeerAddress(),
      message: "connect"
   });
   harness.owner.processWebhook({
      uName: ":building",
      propName: "gate-open",
      propValue: true
   });

   assert.strictEqual(propertyMessages.length, 1);
   assert.strictEqual(propertyMessages[0].propValue, true);
});

runTest("whrelay discovery publishes status and source owner requests", function() {
   var sent = [];
   var harness = createDiscoveryTransport("farm-gate", ":barn-controller", sent);

   harness.transport.startSearching();
   harness.transport.startBroadcasting();
   harness.transport.discoverSourceOwner({
      requestId: "request-1",
      gang: "farm-gate",
      uName: ":building",
      property: "gate-open"
   });

   assert.strictEqual(sent[0].body.whrelayKind, "discovery");
   assert.strictEqual(sent[0].body.discoveryMessage, "status-request");
   assert.strictEqual(sent[1].body.discoveryMessage, "status-request");
   assert.strictEqual(sent[1].body.status, "up");
   assert.strictEqual(sent[1].body.address, "gang-casa://farm-gate/:barn-controller");
   assert.deepStrictEqual({
      discoveryMessage: sent[2].body.discoveryMessage,
      requestId: sent[2].body.requestId,
      gang: sent[2].body.gang,
      uName: sent[2].body.uName,
      property: sent[2].body.property,
      requesterGang: sent[2].body.requesterGang,
      requesterCasa: sent[2].body.requesterCasa
   }, {
      discoveryMessage: "source-owner-request",
      requestId: "request-1",
      gang: "farm-gate",
      uName: ":building",
      property: "gate-open",
      requesterGang: "farm-gate",
      requesterCasa: ":barn-controller"
   });
});

runTest("whrelay discovery emits gang-casa status updates", function() {
   var sent = [];
   var harness = createDiscoveryTransport("main-house", ":home-controller", sent);

   harness.transport.receivedWhRelayDiscoveryMessage({
      __casaWhRelayTransport: true,
      whrelayKind: "discovery",
      whrelayOriginId: "other-origin",
      whrelayMessageId: "status-1",
      discoveryMessage: "status-update",
      gang: "farm-gate",
      casaName: ":barn-controller",
      address: "gang-casa://farm-gate/:barn-controller",
      status: "up"
   });

   assert.deepStrictEqual(harness.statusUpdates[0], {
      gang: "farm-gate",
      name: ":barn-controller",
      status: "up",
      address: "gang-casa://farm-gate/:barn-controller",
      discoveryTransportName: "whrelay",
      messageTransportName: "whrelay",
      tier: 3
   });
});

runTest("whrelay discovery answers source owner requests for locally owned sources", function() {
   var sent = [];
   var harness = createDiscoveryTransport("farm-gate", ":barn-controller", sent);

   harness.sourceMap[":building"] = {
      casa: harness.owner.gang.casa,
      hasProperty: function(_property) {
         return _property === "gate-open";
      },
      events: {}
   };

   harness.transport.receivedWhRelayDiscoveryMessage({
      __casaWhRelayTransport: true,
      whrelayKind: "discovery",
      whrelayOriginId: "other-origin",
      whrelayMessageId: "request-1-message",
      discoveryMessage: "source-owner-request",
      requestId: "request-1",
      gang: "farm-gate",
      uName: ":building",
      property: "gate-open",
      requesterGang: "main-house",
      requesterCasa: ":home-controller"
   });

   assert.strictEqual(sent.length, 1);
   assert.strictEqual(sent[0].body.discoveryMessage, "source-owner-response");
   assert.strictEqual(sent[0].body.requestId, "request-1");
   assert.strictEqual(sent[0].body.casaName, ":barn-controller");
   assert.strictEqual(sent[0].body.address, "gang-casa://farm-gate/:barn-controller");
   assert.strictEqual(sent[0].body.requesterGang, "main-house");
   assert.strictEqual(sent[0].body.requesterCasa, ":home-controller");
});

runTest("whrelay discovery forwards source owner responses only to the requester", function() {
   var sent = [];
   var harness = createDiscoveryTransport("main-house", ":home-controller", sent);

   harness.transport.receivedWhRelayDiscoveryMessage({
      __casaWhRelayTransport: true,
      whrelayKind: "discovery",
      whrelayOriginId: "other-origin",
      whrelayMessageId: "response-other",
      discoveryMessage: "source-owner-response",
      requestId: "request-1",
      gang: "farm-gate",
      uName: ":building",
      property: "gate-open",
      casaName: ":barn-controller",
      address: "gang-casa://farm-gate/:barn-controller",
      requesterGang: "other-gang",
      requesterCasa: ":other-casa"
   });
   harness.transport.receivedWhRelayDiscoveryMessage({
      __casaWhRelayTransport: true,
      whrelayKind: "discovery",
      whrelayOriginId: "other-origin",
      whrelayMessageId: "response-local",
      discoveryMessage: "source-owner-response",
      requestId: "request-1",
      gang: "farm-gate",
      uName: ":building",
      property: "gate-open",
      casaName: ":barn-controller",
      address: "gang-casa://farm-gate/:barn-controller",
      requesterGang: "main-house",
      requesterCasa: ":home-controller"
   });

   assert.strictEqual(harness.sourceOwnerResponses.length, 1);
   assert.deepStrictEqual(harness.sourceOwnerResponses[0], {
      data: {
         __casaWhRelayTransport: true,
         whrelayKind: "discovery",
         whrelayOriginId: "other-origin",
         whrelayMessageId: "response-local",
         discoveryMessage: "source-owner-response",
         requestId: "request-1",
         gang: "farm-gate",
         uName: ":building",
         property: "gate-open",
         casaName: ":barn-controller",
         address: "gang-casa://farm-gate/:barn-controller",
         requesterGang: "main-house",
         requesterCasa: ":home-controller"
      },
      discoveryTransportName: "whrelay",
      messageTransportName: "whrelay",
      tier: 3
   });
});

finishedSchedulingTests = true;
finishTests();
