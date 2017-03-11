var util = require('util');
var Step = require('../step');

function LinearTransformStep(_config, _pipeline) {
   this.inputMin = _config.inputMin;
   this.inputMax = _config.inputMax;
   this.outputMin = _config.outputMin;
   this.outputMax = _config.outputMax;

   this.inverted = (this.inputMin < this.inputMax && this.outputMin > this.outputMax) || (this.inputMin > this.inputMax && this.outputMin < this.outputMax);
   this.inputRange = this.inputMax - this.inputMin;
   this.outputRange = this.outputMax - this.outputMin;

   Step.call(this, _config, _pipeline);
}

util.inherits(LinearTransformStep, Step);

//
// Called by Property or previous Step
// Steps should derive from this to process new input
// Call outputForNextStep() to pass on output to next step (when required)
//
LinearTransformStep.prototype.process = function(_value, _data) {
   console.log(this.uName + ': property ' + _data.propertyName + ' has changed to ' + _value);

   var placeInRange = (_value - this.inputMin) / this.inputRange;
   var outputVal = (this.outputRange * placeInRange) + this.outputMin;

   this.outputForNextStep(outputVal, _data);
}

module.exports = exports = LinearTransformStep;
