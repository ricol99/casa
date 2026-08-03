var assert = require('assert');
var PusherSource = require('../services/nodes/pushersource');

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

function createPusherSourceHarness() {
   var sent = [];
   var scheduled = [];
   var channel = {
      bind: function(_event, _handler, _context) {
         this.event = _event;
         this.handler = _handler;
         this.context = _context;
      }
   };
   var pusherSource = Object.create(PusherSource.prototype);

   pusherSource.uName = ":pusher-source";
   pusherSource.started = false;
   pusherSource.subscriptions = {};
   pusherSource.properties = {};
   pusherSource.gang = {
      casa: {
         uName: ":local-casa"
      }
   };
   pusherSource.owner = {
      pusher: {
         subscribe: function(_channelName) {
            assert.strictEqual(_channelName, "_remote_source");
            return channel;
         }
      },
      sendMessage: function(_channel, _message, _body) {
         sent.push({ channel: _channel, message: _message, body: _body });
      }
   };

   return {
      channel: channel,
      pusherSource: pusherSource,
      scheduled: scheduled,
      sent: sent
   };
}

runTest("pusher source subscription request carries valueType", function() {
   var harness = createPusherSourceHarness();
   var originalSetTimeout = global.setTimeout;

   global.setTimeout = function(_fn, _delay) {
      harness.scheduled.push({ fn: _fn, delay: _delay });
      return { timeout: harness.scheduled.length };
   };

   try {
      harness.pusherSource.newSubscriptionAdded({
         serviceProperty: "level",
         valueType: "number",
         args: {
            pusherSource: ":remote:source"
         }
      });

      assert.strictEqual(harness.sent.length, 1);
      assert.strictEqual(harness.sent[0].channel, "control-channel");
      assert.strictEqual(harness.sent[0].message, "subscription-request");
      assert.strictEqual(harness.sent[0].body.propName, "level");
      assert.strictEqual(harness.sent[0].body.valueType, "number");

      harness.scheduled[0].fn();
      assert.strictEqual(harness.sent.length, 2);
      assert.strictEqual(harness.sent[1].body.valueType, "number");
   }
   finally {
      global.setTimeout = originalSetTimeout;
   }
});
