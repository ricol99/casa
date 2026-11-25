var assert = require('assert');
var fs = require('fs');
var vm = require('vm');
var util = require('../util');

// Exercise the adapter without loading native SPI drivers or opening hardware.
var scheduledInterval;
var sandbox = {
   module: { exports: {} },
   require: function(name) {
      if (name === '../../util') return util;
      if (name === '../../servicenode') return function() {};
      if (name === 'mcp-spi-adc') return {};
      throw new Error('Unexpected dependency: ' + name);
   },
   setInterval: function(callback, interval) { scheduledInterval = interval; return {}; },
   clearInterval: function() {},
   process: { on: function() {} }
};
vm.runInNewContext(fs.readFileSync(require.resolve('../services/nodes/mcpspiadcchannel'), 'utf8'), sandbox);
var Channel = sandbox.module.exports;
var channel = Object.create(Channel.prototype);
var interval = 1000000;
channel.getProperty = function() { return interval; };
channel.alignPropertyValue = function(name, value) {
   assert.strictEqual(name, 'interval');
   interval = value;
};
channel.initialiseAndStartListening = function() {
   this.initialisationStarted = true;
   this.ready = true;
   this.restartListening();
};

channel.newSubscriptionAdded({ args: { interval: 10000 } });
assert.strictEqual(scheduledInterval, 10000, 'default property interval is ten seconds in milliseconds');
channel.newSubscriptionAdded({ args: { interval: 250 } });
assert.strictEqual(scheduledInterval, 250, 'faster subscriber interval reaches the polling timer');
channel.newSubscriptionAdded({ args: { interval: 20000 } });
assert.strictEqual(scheduledInterval, 250, 'slower subscriber must not slow existing polling');
channel.newSubscriptionAdded({ args: {} });
channel.newSubscriptionAdded({});
assert.strictEqual(scheduledInterval, 250, 'subscriptions without an interval retain current polling');
process.stdout.write('[PASS] SPI ADC subscription interval, milliseconds and fastest-subscriber selection\n');
