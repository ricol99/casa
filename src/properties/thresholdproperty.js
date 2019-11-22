var util = require('util');
var Property = require('../property');

function ThresholdProperty(_config, _owner) {
   Property.call(this, _config, _owner);

   // Thresholds with buffer must not overlap
   this.thresholds = (_config.hasOwnProperty("threshold")) ? [_config.threshold] : _config.thresholds;
   this.buffer = _config.buffer;
   this.activeThreshold = -1;
}

util.inherits(ThresholdProperty, Property);

ThresholdProperty.prototype.newEventReceivedFromSource = function(_sourceListener, _data) {
   var newPropertyValue = _data.value;

   if (this.cold) {
      this.cold = false;
   }
   else {
      if (this.activeThreshold == -1) {

         for (var index = 0; index < this.thresholds.length; ++index) {

            if (((this.value >= this.thresholds[index]) && (_data.value <= this.thresholds[index])) ||
                ((this.value <= this.thresholds[index]) && (_data.value >= this.thresholds[index]))) {

               this.activeThreshold = index;
               break;
            }
         }
      }

      if (this.activeThreshold != -1) {

         // We are currently buffering
         if (Math.abs(_data.value - this.thresholds[this.activeThreshold]) > this.buffer) {
            this.activeThreshold = -1;
         }
         else {
            newPropertyValue = this.thresholds[this.activeThreshold];
         }
      }
   }

   this.updatePropertyInternal(newPropertyValue, _data);
};

module.exports = exports = ThresholdProperty;
