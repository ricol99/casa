var util = require('util');
var PipelineStep = require('../pipelinestep');

function TransformStep(_config, _pipeline) {
   PipelineStep.call(this, _config, _pipeline);

   this.transform = _config.transform;
   this.map = _config.map;
}

util.inherits(TransformStep, PipelineStep);

//
// Called by Property or previous Step
// Steps should derive from this to process new input
// Call outputForNextStep() to pass on output to next step (when required)
//
TransformStep.prototype.process = function(_value, _data) {

   var input = _value;
   var newInput = input;

   if (this.transform) {
      var exp = this.transform.replace(/\$value/g, "input");
      eval("newInput = " + exp);
   }

   if (this.map && this.map[newInput] != undefined) {
      newInput = this.map[newInput];
   }

   this.outputForNextStep(newInput, _data);
}

module.exports = exports = TransformStep;
