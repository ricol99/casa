var assert = require('assert');
var PusherService = require('../services/pusherservice');

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

function createTransportHarness() {
   var sent = [];
   var subscribedChannels = [];
   var channelHandlers = {};
   var fakeMessageChannel = {
      bind: function(_event, _handler) {
         channelHandlers[this.name + ":" + _event] = _handler;
      }
   };
   var fakePusher = {
      subscribe: function(_channelName) {
         subscribedChannels.push(_channelName);
         return {
            name: _channelName,
            bind: fakeMessageChannel.bind
         };
      }
   };
   var fakeIoMessageSocketService = {
      addMessageTransport: function(_name, _transport) {
         this.transportName = _name;
         this.transport = _transport;
      }
   };
   var owner = {
      uName: ":pusher-service-test",
      sendMessage: function(_channel, _message, _body) {
         sent.push({ channel: _channel, message: _message, body: _body });
      },
      gang: {
         name: "test-gang",
         casa: {
            uName: ":remote",
            findServiceName: function() {
               return null;
            },
            findService: function() {
               return null;
            }
         }
      }
   };
   var PusherMessageTransport = PusherService.__testExports.PusherMessageTransport;
   var transport = new PusherMessageTransport(owner, fakeIoMessageSocketService);

   return {
      fakeMessageChannel: fakeMessageChannel,
      fakePusher: fakePusher,
      subscribedChannels: subscribedChannels,
      channelHandlers: channelHandlers,
      sent: sent,
      transport: transport
   };
}

function createSharedPusher() {
   var handlers = {};
   var subscribedChannels = [];

   return {
      handlers: handlers,
      subscribedChannels: subscribedChannels,
      pusher: {
         subscribe: function(_channelName) {
            subscribedChannels.push(_channelName);
            return {
               name: _channelName,
               bind: function(_event, _handler) {

                  if (!handlers[_channelName + ":" + _event]) {
                     handlers[_channelName + ":" + _event] = [];
                  }

                  handlers[_channelName + ":" + _event].push(_handler);
               }
            };
         }
      },
      trigger: function(_channel, _event, _body) {
         var eventHandlers = handlers[_channel + ":" + _event] || [];

         for (var i = 0; i < eventHandlers.length; ++i) {
            eventHandlers[i](_body);
         }
      }
   };
}

function createTransport(_gangName, _casaUName, _sharedPusher, _sent) {
   var fakeIoMessageSocketService = {
      addMessageTransport: function(_name, _transport) {
         this.transportName = _name;
         this.transport = _transport;
      }
   };
   var owner = {
      uName: ":pusher-service-" + _gangName + "-" + _casaUName,
      sendMessage: function(_channel, _message, _body) {
         _sent.push({ owner: this, channel: _channel, message: _message, body: _body });
      },
      gang: {
         name: _gangName,
         casa: {
            uName: _casaUName,
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
      }
   };
   var PusherMessageTransport = PusherService.__testExports.PusherMessageTransport;
   var transport = new PusherMessageTransport(owner, fakeIoMessageSocketService);

   transport.start(_sharedPusher.pusher);

   return transport;
}

function createDiscoveryTransportHarness() {
   var sent = [];
   var statusUpdates = [];
   var gangCasaUpdates = [];
   var sourceOwnerResponses = [];
   var handlers = {};
   var sourceMap = {};
   var owner = {
      uName: ":pusher-service-discovery-test",
      sendMessage: function(_channel, _message, _body) {
         sent.push({ channel: _channel, message: _message, body: _body });
      },
      gang: {
         name: "farm-gate",
         casa: {
            name: "barn-controller",
            uName: ":barn-controller"
         },
         findNamedObject: function(_uName) {
            return sourceMap[_uName] || null;
         }
      },
      casaDiscoveryService: {
         addDiscoveryTransport: function(_name, _transport) {
            this.transportName = _name;
            this.transport = _transport;
         },
         casaStatusUpdate: function(_name, _status, _address, _discoveryTransportName, _messageTransportName, _tier) {
            statusUpdates.push({
               name: _name,
               status: _status,
               address: _address,
               discoveryTransportName: _discoveryTransportName,
               messageTransportName: _messageTransportName,
               tier: _tier
            });
         },
         gangCasaStatusUpdate: function(_gang, _name, _status, _address, _discoveryTransportName, _messageTransportName, _tier) {
            gangCasaUpdates.push({
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
            var source = owner.gang.findNamedObject(_data.uName);

            return !!(source && (source.casa === owner.gang.casa) &&
                      (!_data.property || source.hasProperty(_data.property)) &&
                      (!_data.event || (source.events && source.events.hasOwnProperty(_data.event))));
         }
      }
   };
   var controlChannel = {
      bind: function(_event, _handler) {
         handlers[_event] = _handler;
      }
   };
   var PusherDiscoveryTransport = PusherService.__testExports.PusherDiscoveryTransport;
   var transport = new PusherDiscoveryTransport(owner, "pusher", owner.casaDiscoveryService, "pusher", 2);

   transport.start(null, controlChannel);

   return {
      handlers: handlers,
      gangCasaUpdates: gangCasaUpdates,
      owner: owner,
      sent: sent,
      sourceMap: sourceMap,
      sourceOwnerResponses: sourceOwnerResponses,
      statusUpdates: statusUpdates,
      transport: transport
   };
}

function createLargeConsoleEnvelope() {
   return {
      id: "socket-1",
      route: "/consoleapi/io",
      peerAddress: "gang-casa://test-gang/:local",
      destAddress: "gang-casa://test-gang/:remote",
      messageData: {
         message: "execute-output",
         messageData: {
            result: {
               ok: true,
               output: "x".repeat(16000)
            }
         }
      }
   };
}

runTest("oversized console payloads are fragmented below the conservative pusher limit", function() {
   var harness = createTransportHarness();
   var envelope = createLargeConsoleEnvelope();

   harness.transport.sendMessage("message", envelope);

   assert.ok(harness.sent.length > 1);

   for (var i = 0; i < harness.sent.length; ++i) {
      assert.strictEqual(harness.sent[i].channel, harness.transport.messageChannelName("gang-casa://test-gang/:remote"));
      assert.strictEqual(harness.sent[i].message, "message");
      assert.strictEqual(harness.transport.serializedSize(harness.sent[i].body) <= harness.transport.maxPayloadBytes, true);
      assert.strictEqual(harness.sent[i].body.__casaPusherFragment, true);
   }
});

runTest("small console payloads stay as a single bearer message", function() {
   var harness = createTransportHarness();
   var envelope = {
      id: "socket-2",
      route: "/consoleapi/io",
      peerAddress: "gang-casa://test-gang/:local",
      destAddress: "gang-casa://test-gang/:remote",
      messageData: {
         message: "execute-output",
         messageData: {
            result: {
               ok: true
            }
         }
      }
   };

   harness.transport.sendMessage("message", envelope);

   assert.strictEqual(harness.sent.length, 1);
   assert.strictEqual(harness.sent[0].body.__casaPusherFragment, undefined);
   assert.strictEqual(harness.sent[0].body.message, "message");
});

runTest("canonical pusher channel names keep colon-separated addresses distinct", function() {
   var harness = createTransportHarness();

   assert.notStrictEqual(harness.transport.messageChannelName(":ab"), harness.transport.messageChannelName(":a:b"));
   assert.strictEqual(harness.transport.messageChannelNames("gang-casa://test-gang/:remote").length, 1);
});

runTest("gang casa channel names use pusher-safe characters", function() {
   var harness = createTransportHarness();
   var channel = harness.transport.messageChannelName("gang-casa://farm%20gate/:barn%20controller");
   var allowedChannelName = /^[A-Za-z0-9_\-=@,.;]+$/;

   assert.ok(allowedChannelName.test(channel));
});

runTest("pusher discovery advertises gang-qualified casa addresses", function() {
   var harness = createDiscoveryTransportHarness();

   harness.transport.startSearching();
   harness.transport.startBroadcasting();

   assert.deepStrictEqual(harness.sent[0], {
      channel: "control-channel",
      message: "status-request",
      body: {
         gang: "farm-gate",
         casaName: "barn-controller"
      }
   });
   assert.deepStrictEqual(harness.sent[1], {
      channel: "control-channel",
      message: "status-request",
      body: {
         gang: "farm-gate",
         casaName: "barn-controller",
         address: "gang-casa://farm-gate/:barn-controller",
         status: "up"
      }
   });
});

runTest("pusher discovery keeps other gangs out of casa-up but emits gang-casa-up", function() {
   var harness = createDiscoveryTransportHarness();

   harness.transport.searching = true;
   harness.handlers["status-update"]({
      gang: "other-gang",
      casaName: "barn-controller",
      address: "gang-casa://other-gang/:barn-controller",
      status: "up"
   });

   assert.strictEqual(harness.statusUpdates.length, 0);
   assert.deepStrictEqual(harness.gangCasaUpdates[0], {
      gang: "other-gang",
      name: "barn-controller",
      status: "up",
      address: "gang-casa://other-gang/:barn-controller",
      discoveryTransportName: "pusher",
      messageTransportName: "pusher",
      tier: 2
   });
});

runTest("pusher discovery reports same-gang gang-casa addresses", function() {
   var harness = createDiscoveryTransportHarness();

   harness.transport.searching = true;
   harness.handlers["status-update"]({
      gang: "farm-gate",
      casaName: "field-controller",
      address: "gang-casa://farm-gate/:field-controller",
      status: "up"
   });

   assert.deepStrictEqual(harness.statusUpdates[0], {
      name: "field-controller",
      status: "up",
      address: "gang-casa://farm-gate/:field-controller",
      discoveryTransportName: "pusher",
      messageTransportName: "pusher",
      tier: 2
   });
   assert.deepStrictEqual(harness.gangCasaUpdates[0], {
      gang: "farm-gate",
      name: "field-controller",
      status: "up",
      address: "gang-casa://farm-gate/:field-controller",
      discoveryTransportName: "pusher",
      messageTransportName: "pusher",
      tier: 2
   });
});

runTest("pusher discovery publishes source owner requests", function() {
   var harness = createDiscoveryTransportHarness();

   harness.transport.discoverSourceOwner({
      requestId: "request-1",
      gang: "farm-gate",
      uName: ":building",
      property: "gate-open"
   });

   assert.deepStrictEqual(harness.sent[0], {
      channel: "control-channel",
      message: "source-owner-request",
      body: {
         requestId: "request-1",
         gang: "farm-gate",
         uName: ":building",
         property: "gate-open",
         event: undefined,
         requesterGang: "farm-gate",
         requesterCasa: ":barn-controller"
      }
   });
});

runTest("pusher discovery answers source owner requests for locally owned sources", function() {
   var harness = createDiscoveryTransportHarness();

   harness.sourceMap[":building"] = {
      casa: harness.owner.gang.casa,
      hasProperty: function(_property) {
         return _property === "gate-open";
      },
      events: {}
   };

   harness.handlers["source-owner-request"]({
      requestId: "request-1",
      gang: "farm-gate",
      uName: ":building",
      property: "gate-open",
      requesterGang: "home",
      requesterCasa: ":home-casa"
   });

   assert.deepStrictEqual(harness.sent[0], {
      channel: "control-channel",
      message: "source-owner-response",
      body: {
         requestId: "request-1",
         gang: "farm-gate",
         uName: ":building",
         property: "gate-open",
         event: undefined,
         casaName: ":barn-controller",
         address: "gang-casa://farm-gate/:barn-controller"
      }
   });
});

runTest("pusher discovery forwards source owner responses to CasaDiscoveryService", function() {
   var harness = createDiscoveryTransportHarness();

   harness.handlers["source-owner-response"]({
      requestId: "request-1",
      gang: "farm-gate",
      uName: ":building",
      property: "gate-open",
      casaName: ":barn-controller",
      address: "gang-casa://farm-gate/:barn-controller"
   });

   assert.deepStrictEqual(harness.sourceOwnerResponses[0], {
      data: {
         requestId: "request-1",
         gang: "farm-gate",
         uName: ":building",
         property: "gate-open",
         casaName: ":barn-controller",
         address: "gang-casa://farm-gate/:barn-controller"
      },
      discoveryTransportName: "pusher",
      messageTransportName: "pusher",
      tier: 2
   });
});

runAsyncTest("gang casa address connects directly to the gang-qualified casa channel", function(_done) {
   var sharedPusher = createSharedPusher();
   var sent = [];
   var requester = createTransport("main-house", ":same-casa-name", sharedPusher, sent);
   var responder = createTransport("farm-gate", ":same-casa-name", sharedPusher, sent);
   var responderAddress = responder.localPeerAddress();

   responder.on("connect", function(_data) {

      try {
         assert.strictEqual(_data.id, "socket-1");
         assert.strictEqual(_data.route, "/peergangcasa");
         assert.strictEqual(_data.peerAddress, requester.localPeerAddress());
         assert.strictEqual(_data.destAddress, responderAddress);
      }
      catch (_err) {
         return _done(_err);
      }

      _done();
   });

   requester.sendMessage("connect", {
      id: "socket-1",
      route: "/peergangcasa",
      peerAddress: requester.localPeerAddress(),
      destAddress: responderAddress,
      messageData: {
         config: { heartbeat: 0 }
      }
   });

   assert.strictEqual(sent.length, 1);
   assert.strictEqual(sent[0].channel, requester.messageChannelName(responderAddress));
   assert.strictEqual(sent[0].message, "message");
   assert.strictEqual(sent[0].body.message, "connect");

   sharedPusher.trigger(sent[0].channel, sent[0].message, sent[0].body);
});

runAsyncTest("fragmented payloads are reassembled before socket listeners receive them", function(_done) {
   var sharedPusher = createSharedPusher();
   var sent = [];
   var sender = createTransport("test-gang", ":local", sharedPusher, sent);
   var receiver = createTransport("test-gang", ":remote", sharedPusher, sent);
   var envelope = createLargeConsoleEnvelope();
   var expected = JSON.parse(JSON.stringify(envelope));

   expected.message = "message";

   receiver.on("message", function(_data) {
      try {
         assert.deepStrictEqual(_data, expected);
         assert.strictEqual(Object.keys(receiver.pendingMessages).length, 0);
      }
      catch (_err) {
         return _done(_err);
      }

      _done();
   });

   sender.sendMessage("message", envelope);
   sent.forEach( (_item) => {
      sharedPusher.trigger(_item.channel, _item.message, _item.body);
   });
});
