var util = require('util');
var Property = require('../property');

function SmootherProperty(_config, _owner) {
   Property.call(this, _config, _owner);

   this.rate = _config.rate;                    // Change allowed per second
   this.resolution = _config.hasOwnProperty("resolution") ? _config.resolution : 1;

   this.floorOutput = (_config.floorOutput == undefined) ? function(_input) { return Math.floor(_input); } : function(_input) { return _input; };
   this.calculatedResolution = _config.resolution;
   this.targetValue = 0;
   this.timeoutObj = null;
}

util.inherits(SmootherProperty, Property);

// Called when system state is required
SmootherProperty.prototype.export = function(_exportObj) {

   if (Property.prototype.export.call(this, _exportObj)) {
      _exportObj.calculatedResolution = this.calculatedResolution;
      _exportObj.targetValue = this.targetValue;
      _exportObj.timeoutObj = this.timeoutObj ? this.timeoutObj.expiration() : -1;
      return true;
   }

   return false;
};

SmootherProperty.prototype.restartTimer = function() {

   if (this.timeoutObj) {
      util.clearTimeout(this.timeoutObj);
   }

   this.timeoutObj = util.setTimeout( () => {
      this.timeoutObj = null;

      if (this.valid) {
        var difference = this.targetValue - this.value;

         if (Math.abs(difference) <= Math.abs(this.step)) {
            this.updatePropertyInternal(this.targetValue);
         }
         else {
            var newValue = this.value + this.step;
            this.updatePropertyInternal(this.floorOutput(newValue));
            this.restartTimer();
         }
      }
   }, this.calculatedResolution * 1000);
}

SmootherProperty.prototype.newEventReceivedFromSource = function(_sourceListener, _data) {

   if (this.cold) {
      this.cold = false;
      this.updatePropertyInternal(_data.value, _data);
   }
   else if (this.value != _data.value) {
      this.targetValue = _data.value;

      var difference = this.targetValue - this.value;

      var totalTimeToChange = Math.abs(difference) / this.rate;
      var timeToChangeByOne =  totalTimeToChange / Math.abs(difference);
      this.calculatedResolution = timeToChangeByOne * this.resolution;
      this.step = ((difference > 0) ? 1 : -1) * this.resolution;

      if (Math.abs(this.targetValue - this.value) <= Math.abs(this.step)) {
         this.updatePropertyInternal(_data.value, _data);
      }
      else {
         this.restartTimer();
      }
   }
};

module.exports = exports = SmootherProperty;
