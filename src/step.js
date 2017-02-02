var util = require('util');

//
// Constructor
//
function Step(_config, _owner) {
   this.type = _config.type;
   this.owner = _owner;
   this.sourceStep = _config.sourceStep;
   this.value = 0;
   this.lastData = null;
  
   this.enabled = true;
   this.cold = true;
}

//
// Internal - Used to set up step processing pipeline
//
Step.prototype.setNextStep = function(_step) {
   this.nextStep = _step;
}

//
// Called by Property or previous Step 
// Steps should derive from this to process new input
// Call outputForNextStep() to pass on output to next step (when required)
//
Step.prototype.process = function(_value, _data) {
   this.outputForNextStep(_value, _data);
}

//
// Internal - Derived steps call this to pass on their output to the next step in the pipeline
//
Step.prototype.outputForNextStep = function(_outputValue, _data) {
   this.value = _outputValue;
   this.lastData = copyData(_data);

   if (this.sourceStep) {
      this.this.updatePropertyInternal(_outputValue, _data);
   }
   else {
      this.nextStep.process(_outputValue, _data);
   }
}

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

module.exports = exports = Step;
