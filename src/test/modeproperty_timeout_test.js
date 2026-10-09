var assert = require('assert');
var fs = require('fs');
var vm = require('vm');
var util = require('../util');
var StateProperty = require('../properties/stateproperty');

// Capture the generated mode configuration without starting the Casa runtime.
function CapturedStateProperty(_config) {
   this.config = _config;
   this.properties = {};
}
CapturedStateProperty.prototype.createProperty = function(_config) {
   this.properties[_config.name] = _config.initialValue;
};

var sandbox = {
   module: { exports: {} },
   exports: {},
   require: function(_name) {
      return _name === '../util' ? util : CapturedStateProperty;
   }
};
vm.runInNewContext(fs.readFileSync(require.resolve('../properties/modeproperty'), 'utf8'), sandbox);
var ModeProperty = sandbox.module.exports;

[undefined, false, true].forEach(function(_trigger) {
   var mode = { name: 'boost', timeout: 300 };
   if (_trigger !== undefined) {
      mode.triggerOnDurationChange = _trigger;
   }
   var property = new ModeProperty({ name: 'MODE', restingMode: { name: 'auto' }, modes: [mode] });
   var state = property.config.states[1];
   var scheduled;
   var originalSetTimeout = util.setTimeout;
   state.timeout.source.sourceListener = {
      getPropertyValue: function() { return property.properties['BOOST-MODE-DURATION']; }
   };
   var runtime = {
      currentState: state,
      owner: { newTimeoutTransaction: function() {} },
      alignActions: function(_actions) {
         _actions.forEach(function(_action) { property.properties[_action.property] = _action.value; });
      },
      moveToNextState: function(_name) { this.nextState = _name; }
   };
   util.setTimeout = function(_callback, _duration, _data) {
      scheduled = { callback: _callback, duration: _duration, data: _data };
      return scheduled;
   };
   try {
      property.properties['BOOST-MODE-ACTIVE'] = true;
      StateProperty.prototype.setStateTimer.call(runtime, null, state);
      assert.strictEqual(scheduled.duration, 300000);
      scheduled.callback(scheduled.data);
      assert.strictEqual(property.properties['BOOST-MODE-DURATION'], _trigger ? -1 : 300);
      assert.strictEqual(property.properties['BOOST-MODE-ACTIVE'], false);
      assert.strictEqual(runtime.nextState, 'settle-invalid');
      assert.strictEqual(runtime.stateTimer, null);

      // Ordinary modes reuse their duration; triggered modes accept the same request again.
      if (_trigger) {
         property.properties['BOOST-MODE-DURATION'] = 300;
      }
      scheduled = null;
      StateProperty.prototype.setStateTimer.call(runtime, null, state);
      assert.strictEqual(scheduled.duration, 300000);
      process.stdout.write('[PASS] mode expiry and repeat timer, triggerOnDurationChange=' + _trigger + '\n');
   }
   finally {
      util.setTimeout = originalSetTimeout;
   }
});
