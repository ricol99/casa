var util = require('util');

function Pipeline(_config, _owner) {
   this.name = (_config.hasOwnProperty('name')) ? _config.name : "pipeline";
   this.owner = _owner;
   this.name = this.owner.name+"-"+this.name;

   this.loadSteps(_config);
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

Pipeline.prototype.loadSteps = function(_steps) {
   this.steps = [];

   this.firstStep = null;

   var previousStep = null;
   var step = null;

   for (var i = 0; i < _steps.length; ++i) {
      var Step = require('./steps/'+_steps[i].type);
      step = new Step(_steps[i], this);
      this.steps.push(step);

      if (i > 0) {
         previousStep.setNextStep(step);
      }
      else {
         this.firstStep = step;
      }

      previousStep = step;
   }
}

module.exports = exports = Pipeline;
