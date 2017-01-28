var util = require('util');
var PropertyBinder = require('./propertybinder');

function ThresholdPropertyBinder(_config, _owner) {
   // Thresholds with buffer must not overlap
   
   this.thresholds = (_config.threshold != undefined) ? [_config.threshold] : _config.thresholds;
   this.buffer = _config.buffer;
   this.activeThreshold = -1;
   this.lastValue = 0;
   this.cold = true;

   PropertyBinder.call(this, _config, _owner);
}

util.inherits(ThresholdPropertyBinder, PropertyBinder);

ThresholdPropertyBinder.prototype.newPropertyValueReceivedFromSource = function(_sourceListener, _data) {
   var newPropertyValue = _data.propertyValue;

   if (this.cold) {
      this.cold = false;
   }
   else {
      if (this.activeThreshold == -1) {

         for (var index = 0; index < this.thresholds.length; ++index) {

            if (((this.lastValue >= this.thresholds[index]) && (_data.propertyValue <= this.thresholds[index])) ||
                ((this.lastValue <= this.thresholds[index]) && (_data.propertyValue >= this.thresholds[index]))) {

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

   this.lastValue = newPropertyValue;
   this.updatePropertyAfterRead(newPropertyValue, _data);
};

module.exports = exports = ThresholdPropertyBinder;
