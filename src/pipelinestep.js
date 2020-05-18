var util = require('./util');

//
// Constructor
//
function PipelineStep(_config, _pipeline) {
   this.name = _pipeline.name+"-"+_config.type;
   this.type = _config.type;
   this.pipeline = _pipeline;
   this.value = 0;
   this.lastData = null;
  
   this.sourceValid = false;
   this.valid = false;
   this.cold = true;
}

// ================
// EXPORTED METHODS
// ================

//
// Called by Property or previous PipelineStep 
// PipelineSteps should derive from this to process new input
// Call outputForNextStep() to pass on output to next step (when required)
//
PipelineStep.prototype.newInputForProcess = function(_value, _data) {
   this.lastData = util.copy(_data);
   this.process(_value, _data);
}

PipelineStep.prototype.process = function(_value, _data) {
   this.outputForNextStep(_value, _data);
}

//
// Called by property or previous step
// Source has become available
//
PipelineStep.prototype.sourceIsValid = function(_data) {
   console.log(this.pipeline.name + ': Source ' + _data.sourceName + ' property ' + _data.name + ' is now valid');
   this.sourceValid = true;
   var oldValid = this.valid;
   this.valid = this.amIValid();

   if (!oldValid && this.valid) {
      this.goValid(_data);
   }
};

//
// Called by property or previous step
// Source is not available anymore
//
PipelineStep.prototype.sourceIsInvalid = function(_data) {
   console.log(this.pipeline.name + ': Source ' + _data.sourceName + ' property ' + _data.name + ' invalid!');
   this.sourceValid = false;
   var oldValid = this.valid;
   this.valid = this.amIValid();

   // Has the valid stated changed from true to false?
   if (oldValid && !this.valid) {
      this.invalidate();
   }
};

PipelineStep.prototype.amIValid = function() {
   return this.sourceValid;
};

// =========================
// INTERNAL EXPORTED METHODS
// =========================

//
// Internal - Used to set up step processing pipeline
//
PipelineStep.prototype.setNextStep = function(_step) {
   this.nextStep = _step;
}

//
// Internal - called when step in initialised
PipelineStep.prototype.coldStart = function(_data) {
   this.cold = false;
   this.nextStep.coldStart(_data);
};

//
// Internal - Derived steps call this to pass on their output to the next step in the pipeline
//
PipelineStep.prototype.outputForNextStep = function(_outputValue, _data) {
   this.value = _outputValue;

   if (_data == undefined) {
      _data = {};
   }

   this.checkData(_outputValue, _data);
   this.lastData = util.copy(_data);

   if (this.nextStep) {
      this.nextStep.newInputForProcess(_outputValue, _data);
   }
   else {
      this.pipeline.owner.outputFromPipeline(this.pipeline, _outputValue, _data);
   }
}

//
// Internal - Inform next step that I am available
//
PipelineStep.prototype.goValid = function(_data) {

   if (this.nextStep) {
      this.nextStep.sourceIsValid(_data);
   }
   else {
      this.pipeline.owner.sourceIsValidFromPipeline(this.pipeline, _data);
   }
};

//
// Internal - Inform next step that I am not available
//
PipelineStep.prototype.invalidate = function() {

   if (this.nextStep) {
      this.nextStep.sourceIsInvalid({});
   }
   else {
      this.pipeline.owner.sourceIsInvalidFromPipeline(this.pipeline, {});
   }
};

// ==================== 
// NON-EXPORTED METHODS
// ==================== 

PipelineStep.prototype.checkData = function(_value, _data) {

   if (!_data.hasOwnProperty('sourceName')) _data.sourceName = this.lastData.sourceName;
   if (!_data.hasOwnProperty('sourceEventName')) _data.sourceEventName = this.lastData.sourceEventName;
   if (!_data.hasOwnProperty('name')) _data.name = this.lastData.name;
   if (!_data.hasOwnProperty('value')) _data.value = _value;

};


module.exports = exports = PipelineStep;
