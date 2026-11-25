var assert = require('assert');
var CounterProperty = require('../properties/counterproperty');
var SourceListener = require('../sourcelistener');

// Exercise real listener value caching and Property notification dispatch.
function counter(positive) {
   var property = Object.create(CounterProperty.prototype);
   property.uName = ':test:count';
   property.value = 0;
   property.valid = true;
   property.countPositives = positive;
   property.owner = {};
   property.sourceListeners = {};
   property.updates = [];
   property.updatePropertyInternal = function(value, data) {
      this.value = value;
      this.updates.push({ value: value, data: data });
   };
   ['a', 'b'].forEach(function(name) {
      var listener = Object.create(SourceListener.prototype);
      listener.owner = property;
      listener.eventName = name;
      listener.sourceEventName = name;
      listener.casa = { eventLogger: { logReceivedEvent: function() {} } };
      property.sourceListeners[name] = listener;
   });
   return property;
}
function send(property, name, value, coldStart) {
   var data = { name: name, value: value, transaction: 'test' };
   if (coldStart) data.coldStart = true;
   property.sourceListeners[name].internalSourcePropertyChanged(data);
}
var positive = counter(true);
send(positive, 'a', true, true);
assert.strictEqual(positive.value, 1, 'initially active button must count');
send(positive, 'b', false, true);
assert.strictEqual(positive.value, 1);
send(positive, 'a', false);
assert.strictEqual(positive.value, 0, 'turning initial button off must not go negative');
send(positive, 'a', false);
assert.strictEqual(positive.value, 0, 'duplicate false must not decrement');
send(positive, 'a', true);
send(positive, 'a', true);
assert.strictEqual(positive.value, 1, 'duplicate true must not increment');
send(positive, 'b', true);
assert.strictEqual(positive.value, 2, 'overlapping scene buttons must be detected');
send(positive, 'a', false);
assert.strictEqual(positive.value, 1, 'handover leaves one active scene');
send(positive, 'b', false);
assert.strictEqual(positive.value, 0);
positive.value = -5;
send(positive, 'a', true, true);
assert.strictEqual(positive.value, 1, 'startup/reconnection snapshot repairs stale count');
assert.strictEqual(positive.updates[positive.updates.length - 1].data.transaction, 'test');

var ordinary = counter(false);
send(ordinary, 'a', true, true);
send(ordinary, 'b', false, true);
assert.strictEqual(ordinary.value, 0, 'ordinary counters still ignore startup');
send(ordinary, 'a', true);
send(ordinary, 'a', true);
send(ordinary, 'b', false);
assert.strictEqual(ordinary.value, 3, 'ordinary counters count every notification regardless of value');
assert.strictEqual(ordinary.updates.length, 3);
process.stdout.write('[PASS] Positive counting uses current listener values; ordinary event counting unchanged\n');
