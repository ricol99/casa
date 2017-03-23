var util = require('util');
var PipelineStep = require('../pipelinestep');

function EdgeStep(_config, _pipeline) {
   PipelineStep.call(this, _config, _pipeline);

   if (_config.hasOwnProperty('leadingEdgeOutput')) {
      this.leadingEdgeOutput = _config.leadingEdgeOutput;
   }

   if (_config.hasOwnProperty('trailingEdgeOutput')) {
      this.trailingEdgeOutput = _config.trailingEdgeOutput;
   }
}

util.inherits(EdgeStep, PipelineStep);

//
// Called by Property or previous Step
// Steps should derive from this to process new input
// Call outputForNextStep() to pass on output to next step (when required)
//
EdgeStep.prototype.process = function(_value, _data) {

   if (this.value && !_value && this.hasOwnProperty('trailingEdgeOutput')) {
      this.outputForNextStep(this.trailingEdgeOutput, _data);
   }
   else if (!this.value && value && this.hasOwnProperty('leadingEdgeOutput')) {
      this.outputForNextStep(this.leadingEdgeOutput, _data);
   }
}

module.exports = exports = EdgeStep;
