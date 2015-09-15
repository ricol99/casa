var util = require('util');
var PropertyBinder = require('./propertybinder');

function LinearTransformPropertyBinder(_config, _owner) {
   this.inputMin = _config.inputMin;
   this.inputMax = _config.inputMax;
   this.outputMin = _config.outputMin;
   this.outputMax = _config.outputMax;

   this.inverted = (this.inputMin < this.inputMax && this.outputMin > this.outputMax) || (this.inputMin > this.inputMax && this.outputMin < this.outputMax);
   this.inputRange = this.inputMax - this.inputMin;
   this.outputRange = this.outputMax - this.outputMin;

   PropertyBinder.call(this, _config, _owner);

   var that = this;
}

util.inherits(LinearTransformPropertyBinder, PropertyBinder);

LinearTransformPropertyBinder.prototype.sourcePropertyChanged = function(_data) {
   console.log(this.name + ': property ' + _data.propertyName + ' has changed to ' + _data.propertyValue);

   var placeInRange = (_data.propertyValue - this.inputMin) / this.inputRange;
   var outputVal = (this.outputRange * placeInRange) + this.outputMin;

   this.updatePropertyAfterRead(outputVal, _data);
}

module.exports = exports = LinearTransformPropertyBinder;

