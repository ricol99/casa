var assert = require('assert');
require('../util');
var State = require('../state');

var enabled = true;
var state = Object.create(State.prototype);
state.name = 'idle';
state.uName = ':test:idle';
state.owner = { owner: { getProperty: function() { return enabled; } } };

assert.strictEqual(state.checkStateGuards(), null, 'guards are optional');
state.guards = [];
assert.strictEqual(state.checkStateGuards(), null);
state.guards = [{ property: 'enabled', value: true, nextState: 'running' }];
assert.strictEqual(state.checkStateGuards(), 'running', 'matching guard needs no sources');
enabled = false;
assert.strictEqual(state.checkStateGuards(), null, 'nonmatching guard must not transition');
enabled = true;
state.sources = [{ nextState: 'idle' }];
assert.strictEqual(state.checkStateGuards(), 'running', 'unrelated source must not block the guard');
state.guards[0].nextState = 'idle';
assert.strictEqual(state.checkStateGuards(), null, 'self-targeting guard must not transition');
delete state.guards[0].nextState;
assert.strictEqual(state.checkStateGuards(), null, 'guard without a destination must not transition');
state.guards.push({ property: 'enabled', value: true, nextState: 'ready' });
state.guards.push({ property: 'enabled', value: true, nextState: 'later' });
assert.strictEqual(state.checkStateGuards(), 'ready', 'first eligible guard wins');
process.stdout.write('[PASS] state entry guards: optional, match, no match, independent destination and self-target\n');
