var util = require('util');
var Step = require('../step');

function InvertStep(_config, _pipeline) {
   Step.call(this, _config, _pipeline);
}

util.inherits(InvertStep, Step);

//
// Called by Property or previous Step
// Steps should derive from this to process new input
// Call outputForNextStep() to pass on output to next step (when required)
//
InvertStep.prototype.process = function(_value, _data) {

   if (typeof _value === "boolean") {
      this.outputForNextStep(!_value, _data);
   }
   else if (typeof _data.propertyValue === "number") {
      this.outputForNextStep(-_value, _data);
   }
}

module.exports = exports = InvertStep;
