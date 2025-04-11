var util = require('util');
var Property = require('../../property');

function TestProperty(_config, _owner) {
   _config.allSourcesRequiredForValidity = false;
   this.rampFunctions = {};

   Property.call(this, _config, _owner);

   if (_config.hasOwnProperty("rampFunctions")) {

      for (var i = 0; i < _config.rampFunctions.length; ++i) {
         this.rampFunctions[_config.rampFunctions[i].name] = util.copy(_config.rampFunctions[i]);
      }
   }
}

util.inherits(TestProperty, Property);

// Called when system state is required
TestProperty.prototype.export = function(_exportObj) {
   Property.prototype.export.call(this, _exportObj);
};

// Called to restore system state before hot start
TestProperty.prototype.import = function(_importObj) {
   Property.prototype.import.call(this, _importObj);
};

// Called after system state has been restored
TestProperty.prototype.hotStart = function() {
   Property.prototype.hotStart.call(this);
};

// Called to start a cold system
TestProperty.prototype.coldStart = function () {
   Property.prototype.coldStart.call(this);
};

// Provide values in a ramp when using a rampFunction
// @return object - { valueProvided, value }
//   valueProvided - boolean
TestProperty.prototype.provideNextValueForRamp = function(_ramp, _rampConfig, _subRampConfig, _counter) {
   console.log(this.uName + ": provideNextValueForRamp() counter="+_counter);

   var rampConfig = _subRampConfig ? _subRampConfig : _rampConfig;
   var rampFunctionConfig = rampConfig ? (rampConfig.hasOwnProperty("name") ? (this.rampFunctions.hasOwnProperty(rampConfig.name) ? this.rampFunctions[rampConfig.name] : null) : null) : null;
   
   var multiplier = rampFunctionConfig ? rampFunctionConfig.multiplier : 1;

   if (rampFunctionConfig && (_counter === 0)) {
      return rampFunctionConfig.hasOwnProperty("startValue") ? { valueProvided: true, value: rampFunctionConfig.startValue } : { valueProvided: false };
   }
   else if (rampFunctionConfig && (_counter === -1)) {
      return rampFunctionConfig.hasOwnProperty("endValue") ? { valueProvided: true, value: rampFunctionConfig.endValue } : { valueProvided: false };
   }
   else {
      return (_counter === -1) ? { valueProvided: false } : { valueProvided: true, value: _counter * multiplier };
   }
};

module.exports = exports = TestProperty;
