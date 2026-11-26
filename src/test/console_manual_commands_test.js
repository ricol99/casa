var assert = require('assert');
var SourceConsoleCmd = require('../consolecmds/sourceconsolecmd');
var SourceConsoleApi = require('../consoleapis/sourceconsoleapi');
var cmd = Object.create(SourceConsoleCmd.prototype);
var api = Object.create(SourceConsoleApi.prototype);
var calls = [], output = [];
var currentMode = 'auto';
api.myObj = function() { return {
   getProperty: function() { return currentMode; },
   setProperty: function(name, value, data) { calls.push([name, value, data]); return true; }
}; };
cmd.console = { write: function(text) { output.push(text); } };
cmd.executeParsedCommand = function(command, params, callback) {
   api[command]({ name: 'test' }, params, callback);
};
function call(command, args, expectedError) {
   var called = false;
   cmd[command](args, function(error, result) {
      called = true;
      assert.strictEqual(!!error, !!expectedError);
      if (!error) assert.strictEqual(result, true);
   });
   assert(called);
}
call('setManualMode', []);
call('setManualMode', ['120']);
currentMode = 'manual';
call('renewManualOverride', ['60.5']);
call('releaseManualOverride', []);
assert.deepStrictEqual(calls, [['MANUAL-MODE-ACTIVE', true, {}], ['MANUAL-MODE-DURATION', 120, {}], ['MANUAL-MODE-DURATION', 60.5, { forceUpdate: true }], ['MANUAL-MODE-DURATION', -1, {}], ['MANUAL-MODE-ACTIVE', false, {}]]);
var count = calls.length;
call('renewManualOverride', [], true);
call('releaseManualOverride', ['60'], true);
call('setManualMode', ['10', '20'], true);
[0, -1, '', 'abc', 'Infinity', NaN, true].forEach(function(value) {
   call('setManualMode', [value], true);
   call('renewManualOverride', [value], true);
});
['setManualMode', 'renewManualOverride', 'releaseManualOverride'].forEach(function(command) {
   call(command, ['--help']);
});
assert.strictEqual(calls.length, count);
assert.strictEqual(output.length, 3);
process.stdout.write('[PASS] Console manual commands dispatch to paired API, parse seconds, validate and show help\n');
