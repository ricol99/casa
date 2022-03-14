var util = require('util');
var Property = require('../property');

function RollingAverageProperty(_config, _owner) {
   Property.call(this, _config, _owner);
   this.periods = _config.hasOwnProperty("periods") ? _config.periods : 5;
   this.floorOutput = _config.hasOwnProperty("floorOutput") ? _config.floorOutput : false;
   this.periodValues = [];
}

util.inherits(RollingAverageProperty, Property);

// Called when system state is required
RollingAverageProperty.prototype.export = function(_exportObj) {

   if (Property.prototype.export.call(this, _exportObj)) {
      _exportObj.periodValues = this.periodValues;
      return true;
   }

   return false;
};

RollingAverageProperty.prototype.newEventReceivedFromSource = function(_sourceListener, _data) {
   this.periodValues.push(_data.value);

   if (this.periodValues.length > this.periods) {
      this.periodValues.shift();
   }

   var average = 0;

   for (var i = 0; i < this.periodValues.length; ++i) {
      average += this.periodValues[i];
   }

   average = average / parseFloat(this.periodValues.length);

   this.updatePropertyInternal(this.floorOutput ? Math.floor(average) : average, _data);
}

module.exports = exports = RollingAverageProperty;
