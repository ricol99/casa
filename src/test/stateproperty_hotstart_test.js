var assert = require('assert');
var util = require('../util');
var NamedObject = require('../namedobject');
var StateProperty = require('../properties/stateproperty');
var originalSetTimeout = util.setTimeout;
var timers = [];
util.setTimeout = function(callback, duration, data) {
   var timer = { callback: callback, duration: duration, data: data };
   timers.push(timer);
   return timer;
};
try {
   [false, true].forEach(function(regex) {
      var owner = new NamedObject({ name: 'room', type: 'thing' }, ':room');
      var transactions = 0;
      owner.newTimeoutTransaction = function() { transactions++; };
      var definition = { name: regex ? 'numbered' : 'waiting', priority: 50,
         timeout: { duration: 10, nextState: 'done', actions: [{ property: 'power', value: false }] } };
      if (regex) definition.regEx = '^item-[0-9]+$';
      var config = { name: 'machine', type: 'stateproperty', states: [definition] };
      var original = new StateProperty(config, owner);
      original.value = regex ? 'item-42' : 'waiting';
      original.currentState = original.matchState(original.value);
      original.previousState = original.currentState;
      original.stateTimer = { left: function() { return 3500; } };
      var saved = {};
      original.export(saved);
      var restored = new StateProperty(config, owner);
      restored.import(saved);
      assert.strictEqual(restored.currentState, restored.states[definition.name]);
      assert.strictEqual(restored.previousState, restored.currentState);
      assert.strictEqual(restored.value, original.value);
      if (regex) assert.strictEqual(restored.currentState, restored.regExStates[0]);
      var effects = [];
      restored.alignActions = function(actions, priority) {
         assert.deepStrictEqual(actions, definition.timeout.actions);
         assert.strictEqual(priority, 50);
         effects.push('actions');
      };
      restored.moveToNextState = function(name) { effects.push(name); };
      timers = [];
      restored.hotStart();
      assert.strictEqual(timers.length, 1);
      assert.strictEqual(timers[0].duration, 3500);
      timers[0].callback(timers[0].data);
      assert.deepStrictEqual(effects, ['actions', 'done']);
      assert.strictEqual(transactions, 1);
      assert.strictEqual(restored.stateTimer, null);
   });
   process.stdout.write('[PASS] named/regex state restoration and timeout actions before transition\n');
} finally {
   util.setTimeout = originalSetTimeout;
}
