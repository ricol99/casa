var util = require('util');
var Transform = require('./transform');

function LinearTransform(_config) {
   this.inputMin = _config.inputMin;
   this.inputMax = _config.inputMax;
   this.outputMin = _config.outputMin;
   this.outputMax = _config.outputMax;

   this.inverted = (this.inputMin < this.inputMax && this.outputMin > this.outputMax) || (this.inputMin > this.inputMax && this.outputMin < this.outputMax);
   this.inputRange = this.inputMax - this.inputMin;
   this.outputRange = this.outputMax - this.outputMin;

   Transform.call(this, _config);

   var that = this;
}

util.inherits(LinearTransform, Transform);

LinearTransform.prototype.sourcePropertyChanged = function(_data) {
   console.log(this.name + ': property ' + _data.propertyName + ' has changed to ' + _data.propertyValue);

   if (this.target) {
      var placeInRange = (_data.propertyValue - this.inputMin) / this.inputRange;
      var outputVal = (this.outputRange * placeInRange) + this.outputMin;
      console.log(this.name + ': attempting to set property ' + this.targetProperty + ' in target ' + this.target.name + ' to ' + outputVal);

      this.setTargetProperty(outputVal, _data);
   }
}

module.exports = exports = LinearTransform;

