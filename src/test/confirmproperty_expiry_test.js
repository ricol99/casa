var assert = require('assert');
var util = require('../util');
var ConfirmProperty = require('../properties/confirmproperty');
var originalSetTimeout = util.setTimeout;
var originalClearTimeout = util.clearTimeout;
util.setTimeout = function(callback, duration) {
   return { callback: callback, duration: duration, cancelled: false };
};
util.clearTimeout = function(timer) { timer.cancelled = true; };

try {
   var property = Object.create(ConfirmProperty.prototype);
   Object.assign(property, {
      owner: { uName: ':room' }, buffer: {}, bufferLength: 0,
      confirmationInputs: 2, confirmationTimeout: 5, value: false
   });
   var outputs = [];
   property.updatePropertyInternal = function(value, data) {
      this.value = value;
      outputs.push({ value: value, sourceName: data.sourceName });
   };
   ['a', 'b', 'c'].forEach(function(name) {
      property.newEventReceivedFromSource({ uName: name }, { value: true, sourceName: name });
   });
   assert.deepStrictEqual(outputs.map(function(item) { return item.value; }), [true]);
   assert.strictEqual(property.buffer.a.timeout.duration, 5000);
   property.buffer.a.timeout.callback();
   assert.strictEqual(property.bufferLength, 2);
   assert.strictEqual(property.value, true);
   assert.strictEqual(outputs.length, 1, 'expiry above threshold must not publish again');

   var oldTimer = property.buffer.b.timeout;
   property.newEventReceivedFromSource({ uName: 'b' }, { value: true, sourceName: 'b' });
   assert.strictEqual(oldTimer.cancelled, true);
   assert.strictEqual(property.bufferLength, 2, 'repeat input refreshes rather than double-counts');
   property.buffer.b.timeout.callback();
   assert.strictEqual(property.bufferLength, 1);
   assert.strictEqual(property.value, false);
   assert.deepStrictEqual(outputs[1], { value: false, sourceName: ':room' });
   property.buffer.c.timeout.callback();
   assert.strictEqual(property.bufferLength, 0);
   assert.strictEqual(outputs.length, 2, 'remaining expiry must not repeat false');
   process.stdout.write('[PASS] confirmation expiry publishes only threshold changes and honours refreshed timers\n');
} finally {
   util.setTimeout = originalSetTimeout;
   util.clearTimeout = originalClearTimeout;
}
