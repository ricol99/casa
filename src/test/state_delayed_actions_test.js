var assert = require('assert');
var util = require('../util');
var State = require('../state');

var originalSetTimeout = util.setTimeout;
var originalClearTimeout = util.clearTimeout;
var timers = [];
util.setTimeout = function(callback, duration, data) {
   var timer = { callback: callback, duration: duration, data: data, cancelled: false };
   timers.push(timer);
   return timer;
};
util.clearTimeout = function(timer) { timer.cancelled = true; };

try {
   var applied = [];
   var handlers = [];
   var state = Object.create(State.prototype);
   state.priority = 50;
   state.actionTimeouts = [];
   state.owner = {
      alignActions: function(actions, priority) { applied.push({ actions: actions, priority: priority }); },
      launchActionFunction: function(handler, priority) { handlers.push({ handler: handler, priority: priority }); }
   };
   var first = { property: 'power', value: true, delay: 2 };
   var second = { property: 'level', value: 25, delay: 1 };
   assert.deepStrictEqual(state.filterActions([first, second]), []);
   assert.strictEqual(applied.length, 0, 'actions must wait for their timers');
   assert.deepStrictEqual(timers.map(function(timer) { return timer.duration; }), [2000, 1000]);
   // Fire out of insertion order to verify each callback retains its own action.
   timers[1].callback(timers[1].data);
   timers[0].callback(timers[0].data);
   assert.deepStrictEqual(applied, [
      { actions: [second], priority: 50 },
      { actions: [first], priority: 50 }
   ]);
   assert.deepStrictEqual(state.actionTimeouts, [null, null]);

   state.filterActions([{ handler: 'onDelay', delay: 1 }]);
   timers[2].callback(timers[2].data);
   assert.deepStrictEqual(handlers, [{ handler: 'onDelay', priority: 50 }]);

   state.filterActions([{ property: 'power', value: false, delay: 3 }]);
   state.exiting();
   assert.strictEqual(timers[3].cancelled, true, 'state exit must cancel pending timers');
   assert.deepStrictEqual(state.actionTimeouts, []);
   var count = applied.length;
   timers[3].callback(timers[3].data);
   assert.strictEqual(applied.length, count, 'cleared action must not execute');
   process.stdout.write('[PASS] delayed actions, handler dispatch and exit cancellation\n');
} finally {
   util.setTimeout = originalSetTimeout;
   util.clearTimeout = originalClearTimeout;
}
