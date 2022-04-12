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

// Called when system state is required
ThresholdProperty.prototype.export = function(_exportObj) {
   Property.prototype.export.call(this, _exportObj);
   _exportObj.activeThreshold = this.activeThreshold;
};

// Called to restore system state before hot start
ThresholdProperty.prototype.import = function(_importObj) {
   Property.prototype.import.call(this, _importObj);
   this.activeThreshold = _importObj.activeThreshold;
};

// Called after system state has been restored
ThresholdProperty.prototype.hotStart = function() {
   Property.prototype.hotStart.call(this);
};

// Called to start a cold system
ThresholdProperty.prototype.coldStart = function () {
   Property.prototype.coldStart.call(this);
};

ThresholdProperty.prototype.newEventReceivedFromSource = function(_sourceListener, _data) {
   var newPropertyValue = _data.value;

   if (!this.cold) {

      if (this.activeThreshold == -1) {

         for (var index = 0; index < this.thresholds.length; ++index) {

            if (((this.value >= this.thresholds[index]) && (newPropertyValue <= this.thresholds[index])) ||
                ((this.value <= this.thresholds[index]) && (newPropertyValue >= this.thresholds[index]))) {

               this.activeThreshold = index;
               break;
            }
         }
      }

      if (this.activeThreshold != -1) {

         // We are currently buffering
         if (Math.abs(newPropertyValue - this.thresholds[this.activeThreshold]) > this.buffer) {
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
