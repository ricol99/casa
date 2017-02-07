var util = require('util');

function Pipeline(_config, _owner) {
   this.name = (_config.name != undefined) ? _config.name : "pipeline";
   this.owner = _owner;
   this.uName = this.owner.uName+":"+this.name;

   loadSteps(this, _config);
}

//
// Used to pass new input into the pipeline for processing
// Output step pipeline still executes
//
Pipeline.prototype.newInputForProcess = function(_propValue, _data) {
   this.firstStep.newInputForProcess(_propValue, _data);
};

//
// Called by Pipeline owner as a defined source has become valid again (available)
//
Pipeline.prototype.sourceIsValid = function(_data) {
   this.firstStep.sourceIsValid(_data);
}

//
// Called by Pipeline owner as a defined source has become invalid (unavailable)
//
Pipeline.prototype.sourceIsInvalid = function(_data) {
   this.firstStep.sourceIsInvalid(_data);
};

// Override this if you listen to a source that is not "Source".
// If you listen to a "Source" you will be fired by that Source cold starting
Pipeline.prototype.coldStart = function(_data) {
   this.firstStep.coldStart(_data);
};

// ====================
// NON-EXPORTED METHODS
// ====================

function loadSteps(_this, _steps) {
   _this.steps = [];

   _this.firstStep = null;

   var previousStep = null;
   var step = null;

   for (var i = 0; i < _steps.length; ++i) {
      var Step = require('./'+_steps[i].type);
      step = new Step(_steps[i], _this);
      _this.steps.push(step);

      if (i > 0) {
         previousStep.setNextStep(step);
      }
      else {
         _this.firstStep = step;
      }

      previousStep = step;
   }
}


module.exports = exports = Pipeline;

function LastStep(_pipeline) {
   Step.call(this, _config, _owner);

   this.pipeline = _pipeline;
}

//
// Called by Property or previous Step
// Steps should derive from this to process new input
// Call outputForNextStep() to pass on output to next step (when required)
//
LastStep.prototype.process = function(_value, _data) {
   this.pipeline.owner.outputFromPipeline(this.pipeline, _value, _data);
};

//
// Called by property or previous step
// Source has become available
//
LastStep.prototype.sourceIsValid = function(_data) {
   this.pipeline.owner.sourceIsValidFromPipeline(this.pipeline, _data);
};

//
// Called by property or previous step
// Source is not available anymore
//
LastStep.prototype.sourceIsInvalid = function(_data) {
   this.pipeline.owner.sourceIsInvalidFromPipeline(this.pipeline, _data);
};
