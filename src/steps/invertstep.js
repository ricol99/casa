var util = require('util');
var PipelineStep = require('../pipelinestep');

function InvertStep(_config, _pipeline) {
   PipelineStep.call(this, _config, _pipeline);
}

util.inherits(InvertStep, PipelineStep);

//
// Called by Property or previous Step
// Steps should derive from this to process new input
// Call outputForNextStep() to pass on output to next step (when required)
//
InvertStep.prototype.process = function(_value, _data) {

   if (typeof _value === "boolean") {
      this.outputForNextStep(!_value, _data);
   }
   else if (typeof _data.value === "number") {
      this.outputForNextStep(-_value, _data);
   }
}

module.exports = exports = InvertStep;
