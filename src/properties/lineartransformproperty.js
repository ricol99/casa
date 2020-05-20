var util = require('util');
var Property = require('../property');

function LinearTransformProperty(_config, _owner) {
   Property.call(this, _config, _owner);

   this.inputMin = _config.inputMin;
   this.inputMax = _config.inputMax;
   this.outputMin = _config.outputMin;
   this.outputMax = _config.outputMax;

   this.inverted = (this.inputMin < this.inputMax && this.outputMin > this.outputMax) || (this.inputMin > this.inputMax && this.outputMin < this.outputMax);
   this.inputRange = this.inputMax - this.inputMin;
   this.outputRange = this.outputMax - this.outputMin;
}

util.inherits(LinearTransformProperty, Property);

LinearTransformProperty.prototype.newEventReceivedFromSource = function(_sourceListener, _data) {
   console.log(this.uName + ': property ' + _data.name + ' has changed to ' + _data.value);

   var placeInRange = (_data.value - this.inputMin) / this.inputRange;
   var outputVal = (this.outputRange * placeInRange) + this.outputMin;
   this.updatePropertyInternal(outputVal, _data);
}

module.exports = exports = LinearTransformProperty;
