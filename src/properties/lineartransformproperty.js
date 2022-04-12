var util = require('util');
var Property = require('../property');

function LinearTransformProperty(_config, _owner) {
   Property.call(this, _config, _owner);

   this.inputMin = _config.inputMin;
   this.inputMax = _config.inputMax;
   this.outputMin = _config.outputMin;
   this.outputMax = _config.outputMax;
   this.floorOutput = _config.hasOwnProperty("floorOutput") ? _config.floorOutput : false;

   this.inverted = (this.inputMin < this.inputMax && this.outputMin > this.outputMax) || (this.inputMin > this.inputMax && this.outputMin < this.outputMax);
   this.inputRange = this.inputMax - this.inputMin;
   this.outputRange = this.outputMax - this.outputMin;
}

util.inherits(LinearTransformProperty, Property);

// Called when system state is required
LinearTransformProperty.prototype.export = function(_exportObj) {
   Property.prototype.export.call(this, _exportObj);
};

// Called to restore system state before hot start
LinearTransformProperty.prototype.import = function(_importObj) {
   Property.prototype.import.call(this, _importObj);
};

// Called after system state has been restored
LinearTransformProperty.prototype.hotStart = function() {
   Property.prototype.hotStart.call(this);
};

// Called to start a cold system
LinearTransformProperty.prototype.coldStart = function () {
   Property.prototype.coldStart.call(this);
};

LinearTransformProperty.prototype.newEventReceivedFromSource = function(_sourceListener, _data) {
   console.log(this.uName + ': property ' + _data.name + ' has changed to ' + _data.value);

   var placeInRange = (_data.value - this.inputMin) / this.inputRange;
   var outputVal = (this.outputRange * placeInRange) + this.outputMin;

   this.updatePropertyInternal(this.floorOutput ? Math.floor(outputVal) : outputVal, _data);
}

module.exports = exports = LinearTransformProperty;
