var util = require('util');
var Step = require('./step');

function ThresholdStep(_config, _owner) {
   // Thresholds with buffer must not overlap
   
   this.thresholds = (_config.threshold != undefined) ? [_config.threshold] : _config.thresholds;
   this.buffer = _config.buffer;
   this.activeThreshold = -1;
   this.cold = true;
   this.value = 0;

   Step.call(this, _config, _owner);
}

util.inherits(ThresholdStep, Step);

ThresholdStep.prototype.process = function(_value, _data) {
   var newPropertyValue = _value;

   if (this.cold) {
      this.cold = false;
   }
   else {
      if (this.activeThreshold == -1) {

         for (var index = 0; index < this.thresholds.length; ++index) {

            if (((this.value >= this.thresholds[index]) && (_data.propertyValue <= this.thresholds[index])) ||
                ((this.value <= this.thresholds[index]) && (_data.propertyValue >= this.thresholds[index]))) {

               this.activeThreshold = index;
               break;
            }
         }
      }

      if (this.activeThreshold != -1) {

         // We are currently buffering
         if (Math.abs(_data.propertyValue - this.thresholds[this.activeThreshold]) > this.buffer) {
            this.activeThreshold = -1;
         }
         else {
            newPropertyValue = this.thresholds[this.activeThreshold];
         }
      }
   }

   this.outputForNextStep(newPropertyValue, _data);
};

module.exports = exports = ThresholdStep;