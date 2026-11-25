var assert = require('assert');
var util = require('../util');
var NamedObject = require('../namedobject');
var StateProperty = require('../properties/stateproperty');

['duration', 'property', 'source', 'inherited'].forEach(function(kind) {
   var effects = [];
   var timeout = { nextState: 'done', actions: [{ property: 'timeout-effect', value: true }] };
   if (kind === 'duration') timeout.duration = 0;
   if (kind === 'property') timeout.property = 'duration';
   if (kind === 'source') timeout.source = { sourceListener: { getPropertyValue: function() { return 0; } } };
   timeout.inheritsFrom = kind === 'inherited' ? { previous: true } : {};
   var runtime = {
      owner: { getProperty: function() { return 0; } },
      alignActions: function(actions, priority) {
         assert.strictEqual(priority, 50);
         effects.push(actions[0].property);
      }
   };
   var next = StateProperty.prototype.setStateTimer.call(runtime,
      kind === 'inherited' ? { name: 'previous' } : null,
      { priority: 50, timeout: timeout }, kind === 'inherited' ? 0 : undefined);
   assert.strictEqual(next, 'done');
   assert.deepStrictEqual(effects, ['timeout-effect']);
});

var owner = new NamedObject({ name: 'room', type: 'thing' }, ':room');
var machine = new StateProperty({ name: 'machine', type: 'stateproperty', states: [
   { name: 'immediate', actions: [{ property: 'entry', value: true }],
     timeout: { duration: 0, action: { property: 'timeout', value: true }, nextState: 'done' } },
   { name: 'done', actions: [{ property: 'destination', value: true }] }
] }, owner);
var order = [];
machine.alignActions = function(actions) {
   if (actions) actions.forEach(function(action) { order.push(action.property); });
};
machine.takeControl = function() {};
machine.flushBufferedActionsInternal = function() {};
machine.setState(null, 'immediate', false);
assert.deepStrictEqual(order, ['entry', 'timeout', 'destination']);
assert.strictEqual(machine.currentState.name, 'done');

var actions = 0;
var runtime = { alignActions: function() { actions++; } };
assert.strictEqual(StateProperty.prototype.setStateTimer.call(runtime, null,
   { timeout: { duration: 0, actions: [{}] } }), undefined);
assert.strictEqual(actions, 1, 'zero timeout without a destination still performs its actions');
StateProperty.prototype.setStateTimer.call(runtime, null, { timeout: { duration: -1, actions: [{}] } });
assert.strictEqual(actions, 1, 'disabled timeout must not execute actions');
process.stdout.write('[PASS] zero timeout actions precede transition for fixed, property, source and inherited durations\n');
