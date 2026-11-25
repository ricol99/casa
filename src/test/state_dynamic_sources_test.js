var assert = require('assert');
require('../util');
var State = require('../state');
var StateProperty = require('../properties/stateproperty');
var SourceBase = require('../sourcebase');

var stopped = [];
var mainName = ':sensor:motion:true';
var guardName = ':room:enabled:true';
var owner = {
   owner: { uName: ':room', generateDynamicSourceId: SourceBase.prototype.generateDynamicSourceId },
   sourceListeners: {},
   fetchOrCreateSourceListener: StateProperty.prototype.fetchOrCreateSourceListener,
   removeSourceListenerIfNecessary: StateProperty.prototype.removeSourceListenerIfNecessary
};
// Seed listener instances so the real acquisition/release paths need no runtime or I/O.
[mainName, guardName].forEach(function(name) {
   owner.sourceListeners[name] = {
      sourceEventName: name, referenceCount: 0,
      stopListening: function() { stopped.push(name); }
   };
});
var mainListener = owner.sourceListeners[mainName];
var guardListener = owner.sourceListeners[guardName];
var state = Object.create(State.prototype);
var otherState = Object.create(State.prototype);
[state, otherState].forEach(function(item) {
   item.owner = owner;
   item.sources = [];
   item.sourceMap = {};
   item.activeGuardedSources = [];
});
var first = { uName: ':sensor', property: 'motion', value: true, guard: { previousState: 'first' } };
var middle = { uName: ':sensor', property: 'motion', value: true, guard: { property: 'enabled', value: true } };
var last = { uName: ':sensor', property: 'motion', value: true, guard: { previousState: 'last' } };
[first, middle, last].forEach(function(config) { state.addNewSource(config); });
otherState.addNewSource(middle);
assert.strictEqual(mainListener.referenceCount, 4);
assert.strictEqual(guardListener.referenceCount, 2);
var firstSource = state.sources[0];
var removedSource = state.sources[1];
var lastSource = state.sources[2];
state.activeGuardedSources = [removedSource, firstSource, removedSource];

state.removeExistingSource(middle);
assert.deepStrictEqual(state.sources, [firstSource, lastSource]);
assert.deepStrictEqual(state.sourceMap[mainName], [firstSource, lastSource]);
assert.deepStrictEqual(state.activeGuardedSources, [firstSource]);
assert.strictEqual(mainListener.referenceCount, 3);
assert.strictEqual(guardListener.referenceCount, 1);
assert.deepStrictEqual(stopped, []);
state.removeExistingSource(middle);
assert.strictEqual(mainListener.referenceCount, 3, 'repeat removal must not release again');
assert.strictEqual(guardListener.referenceCount, 1);

state.removeExistingSource(first);
state.removeExistingSource(last);
assert.deepStrictEqual(state.sources, []);
assert.deepStrictEqual(state.sourceMap, {});
assert.deepStrictEqual(state.activeGuardedSources, []);
assert.strictEqual(mainListener.referenceCount, 1, 'other state keeps the listener alive');
assert.deepStrictEqual(stopped, []);
assert.strictEqual(otherState.sourceMap[mainName].length, 1);

otherState.removeExistingSource(middle);
assert.deepStrictEqual(owner.sourceListeners, {});
assert.deepStrictEqual(stopped, [mainName, guardName]);
otherState.removeExistingSource(middle);
assert.strictEqual(stopped.length, 2, 'each listener stops only once');
process.stdout.write('[PASS] dynamic source removal preserves mappings, active guards and shared listener lifetimes\n');
