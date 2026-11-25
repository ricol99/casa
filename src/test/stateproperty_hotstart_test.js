var assert = require('assert');
var util = require('../util');
var NamedObject = require('../namedobject');
var StateProperty = require('../properties/stateproperty');
var State = require('../state');
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

   [null, 0, 250].forEach(function(remaining) {
      var owner = new NamedObject({ name: 'room', type: 'thing' }, ':room');
      var config = { name: 'timer', type: 'stateproperty', states: [
         { name: 'waiting', timeout: { duration: -1, nextState: 'done' } }
      ] };
      var original = new StateProperty(config, owner);
      original.currentState = original.states.waiting;
      original.stateTimer = remaining === null ? null : { left: function() { return remaining; } };
      var saved = {};
      original.export(saved);
      var restored = new StateProperty(config, owner);
      restored.import(saved);
      timers = [];
      restored.hotStart();
      assert.strictEqual(timers.length, remaining === null ? 0 : 1);
      if (remaining !== null) assert.strictEqual(timers[0].duration, remaining);
      else assert.strictEqual(restored.stateTimer, null);
   });

   var state = Object.create(State.prototype);
   var applied = [];
   Object.assign(state, {
      eventQueue: [], myNamedObjects: {}, priority: 10,
      owner: { alignActions: function(actions) { applied.push(actions[0].property); } },
      actionTimeouts: [
         { action: { property: 'first', value: true }, timeout: 1000 },
         null,
         { action: { property: 'last', value: false }, timeout: 2000 }
      ]
   });
   timers = [];
   state.hotStart();
   assert.deepStrictEqual(timers.map(function(timer) { return timer.data; }), [0, 2]);
   assert.deepStrictEqual(timers.map(function(timer) { return timer.duration; }), [1000, 2000]);
   timers.forEach(function(timer) { timer.callback(timer.data); });
   assert.deepStrictEqual(applied, ['first', 'last']);
   assert.deepStrictEqual(state.actionTimeouts, [null, null, null]);
   process.stdout.write('[PASS] inactive/zero/positive timer restoration and distinct delayed-action indices\n');
} finally {
   util.setTimeout = originalSetTimeout;
}
