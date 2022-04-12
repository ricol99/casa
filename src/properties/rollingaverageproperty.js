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
   Property.prototype.export.call(this, _exportObj);
   _exportObj.periodValues = util.copy(this.periodValues);
};

// Called to restore system state before hot start
RollingAverageProperty.prototype.import = function(_importObj) {
   Property.prototype.import.call(this, _importObj);
   this.periodValues = util.copy(_importObj.periodValues);
};

// Called after system state has been restored
RollingAverageProperty.prototype.hotStart = function() {
   Property.prototype.hotStart.call(this);
};

// Called to start a cold system
RollingAverageProperty.prototype.coldStart = function () {
   Property.prototype.coldStart.call(this);
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
