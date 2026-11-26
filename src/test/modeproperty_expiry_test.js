var assert = require('assert');
var ModeProperty = require('../properties/modeproperty');

// Exercise timer lifecycle with the real ModeProperty methods and timer implementation.
var mode = Object.create(ModeProperty.prototype);
mode.name = 'MODE';
var values = {};
mode.owner = { uName: ':room', setProperty: function(name, value) { values[name] = value; } };
mode.currentState = { name: 'manual', timeout: { duration: 30, inheritsFrom: {}, nextState: 'auto' } };
mode.setStateTimer(null, mode.currentState);
assert.strictEqual(values['MODE-EXPIRES-AT'], mode.stateTimer.expiration());
assert(values['MODE-EXPIRES-AT'] > Date.now() + 29000);
mode.clearStateTimer();
assert.strictEqual(values['MODE-EXPIRES-AT'], -1);
mode.currentState = { name: 'settle-invalid', timeout: { duration: 0.1, inheritsFrom: {}, nextState: 'auto' } };
mode.setStateTimer(null, mode.currentState);
assert.strictEqual(values['MODE-EXPIRES-AT'], -1, 'settling is not mode expiry');
mode.clearStateTimer();
mode.currentState = { name: 'manual', timeout: { duration: -1, inheritsFrom: {}, nextState: 'auto' } };
mode.setStateTimer(null, mode.currentState);
assert.strictEqual(values['MODE-EXPIRES-AT'], -1, 'indefinite mode has no expiry');

// Hot start delegates tree restoration to the existing implementation, then republishes
// the expiry calculated from the restored remaining time, not the old wall-clock date.
mode.myNamedObjects = {};
mode.eventQueue = [];
mode.currentState.timeout.duration = 30;
mode.stateTimer = 2500;
mode.hotStart();
assert.strictEqual(values['MODE-EXPIRES-AT'], mode.stateTimer.expiration());
assert(values['MODE-EXPIRES-AT'] >= Date.now() + 2400);
mode.clearStateTimer();
mode.stateTimer = null;
values['MODE-EXPIRES-AT'] = 123;
mode.hotStart();
assert.strictEqual(values['MODE-EXPIRES-AT'], -1, 'inactive restored timer clears stale expiry');
process.stdout.write('[PASS] Mode expiry publication, cancellation, settling, indefinite mode and hot start\n');
