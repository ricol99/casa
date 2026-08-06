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

function createLargeConsoleEnvelope() {
   return {
      id: "socket-1",
      route: "/consoleapi/io",
      peerAddress: ":local",
      destAddress: ":remote",
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
      assert.ok(harness.sent[i].channel === harness.transport.messageChannelName(":remote") ||
                harness.sent[i].channel === harness.transport.legacyMessageChannelName(":remote"));
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
      peerAddress: ":local",
      destAddress: ":remote",
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

   assert.strictEqual(harness.sent.length, 2);
   assert.strictEqual(harness.sent[0].body.__casaPusherFragment, undefined);
   assert.strictEqual(harness.sent[0].body.message, "message");
});

runTest("canonical pusher channel names keep colon-separated casas distinct", function() {
   var harness = createTransportHarness();

   assert.notStrictEqual(harness.transport.messageChannelName(":ab"), harness.transport.messageChannelName(":a:b"));
   assert.strictEqual(harness.transport.legacyMessageChannelName(":ab"), harness.transport.legacyMessageChannelName(":a:b"));
});

runAsyncTest("fragmented payloads are reassembled before socket listeners receive them", function(_done) {
   var harness = createTransportHarness();
   var envelope = createLargeConsoleEnvelope();
   var expected = JSON.parse(JSON.stringify(envelope));

   expected.message = "message";
   harness.transport.start(harness.fakePusher);

   harness.transport.on("message", function(_data) {
      try {
         assert.deepStrictEqual(_data, expected);
         assert.strictEqual(Object.keys(harness.transport.pendingMessages).length, 0);
      }
      catch (_err) {
         return _done(_err);
      }

      _done();
   });

   harness.transport.sendMessage("message", envelope);
   harness.sent.forEach( (_item) => {
      var handler = harness.channelHandlers[_item.channel + ":message"];
      assert.ok(handler);
      handler(_item.body);
   });
});
