var util = require('util');

//
// Constructor
//
function Step(_config, _pipeline) {
   this.uName = _config.type+":ANONYMOUS";
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
// Called by Property or previous Step 
// Steps should derive from this to process new input
// Call outputForNextStep() to pass on output to next step (when required)
//
Step.prototype.newInputForProcess = function(_value, _data) {
   this.lastData = copyData(_data);
   this.process(_value, _data);
}

Step.prototype.process = function(_value, _data) {
   this.outputForNextStep(_value, _data);
}

//
// Called by property or previous step
// Source has become available
//
Step.prototype.sourceIsValid = function(_data) {
   console.log(this.pipeline.uName + ': Source ' + _data.sourceName + ' property ' + _data.propertyName + ' is now valid');
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
Step.prototype.sourceIsInvalid = function(_data) {
   console.log(this.pipeline.uName + ': Source ' + _data.sourceName + ' property ' + _data.propertyName + ' invalid!');
   this.sourceValid = false;
   var oldValid = this.valid;
   this.valid = this.amIValid();

   // Has the valid stated changed from true to false?
   if (oldValid && !this.valid) {
      this.goInvalid(_data);
   }
};

Step.prototype.amIValid = function() {
   return this.sourceValid;
};

// =========================
// INTERNAL EXPORTED METHODS
// =========================

//
// Internal - Used to set up step processing pipeline
//
Step.prototype.setNextStep = function(_step) {
   this.nextStep = _step;
}

//
// Internal - called when step in initialised
Step.prototype.coldStart = function(_data) {
   this.nextStep.coldStart(_data);
};

//
// Internal - Derived steps call this to pass on their output to the next step in the pipeline
//
Step.prototype.outputForNextStep = function(_outputValue, _data) {
   this.value = _outputValue;

   if (_data == undefined) {
      _data = {};
   }

   checkData(this, _outputValue, _data);
   this.lastData = copyData(_data);

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
Step.prototype.goValid = function(_data) {

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
Step.prototype.goInvalid = function(_data) {

   if (this.nextStep) {
      this.nextStep.sourceIsInvalid(_data);
   }
   else {
      this.pipeline.owner.sourceIsInvalidFromPipeline(this.pipeline, _data);
   }
};

// ==================== 
// NON-EXPORTED METHODS
// ==================== 

function copyData(_sourceData) {
   var newData = {};

   for (var prop in _sourceData) {

      if (_sourceData.hasOwnProperty(prop)){
         newData[prop] = _sourceData[prop];
      }
   }

   return newData;
}

function checkData(_this, _value, _data) {

   if (_data.sourceName == undefined) _data.sourceName = _this.lastData.sourceName;
   if (_data.sourcePropertyName == undefined) _data.sourcePropertyName = _this.lastData.sourcePropertyName;
   if (_data.properyName == undefined) _data.propertyName = _this.lastData.propertyName;
   if (_data.properyValue == undefined) _data.propertyValue = _value;

}


module.exports = exports = Step;
