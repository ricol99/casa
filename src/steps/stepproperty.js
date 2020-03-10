var util = require('util');
var Property = require('../property');
var SourceListener = require('../sourcelistener');
var Pipeline = require('../pipeline');

function StepProperty(_config, _owner) {

   Property.call(this, _config, _owner);

   if (_config.sourceSteps) {
      this.sourcePipeline = new Pipeline(_config.sourceSteps, this);
      this.pipeline = this.sourcePipeline;
   }

   if (_config.outputSteps) {
      this.outputPipeline = new Pipeline(_config.outputSteps, this);

      if (this.sourcePipeline == undefined) {
         this.pipeline = this.outputPipeline;
      }
   }
}

util.inherits(StepProperty, Property);

//
// Internal method - Called by the last step in the pipeline
//
StepProperty.prototype.outputFromPipeline = function(_pipeline, _newValue, _data) {

   if (_pipeline == this.sourcePipeline) {
      console.log(this.uName+": output from source pipeline. Property Value="+_newValue);

      var propValue = this.transformNewPropertyValue(_newValue, _data);

      if (propValue != undefined) {
         _data.value = propValue;
         this.setPropertyInternal(propValue, _data);
      }
   }
   else {
      console.log(this.uName+": output from output step pipeline. Property Value="+_newValue+". Call hook outputStepsComplete()");
      this.outputStepsComplete(_newValue, _data);
   }
};

//
// Internal method - Called by the last step in the pipeline
//
StepProperty.prototype.sourceIsValidFromPipeline = function(_pipeline, _data) {

   if (_pipeline == this.sourcePipeline) {

      if (this.outputPipeline) {
         this.outputPipeline.sourceIsValid(_data);
      }
      else {
         this.goValid(_data);
      }
   }
   else {
      this.goValid(_data);
   }
}

//
// Internal method - Called by the last step in the pipeline
//
StepProperty.prototype.sourceIsInvalidFromPipeline = function(_pipeline, _data) {

   if (_pipeline == this.sourcePipeline) {

      if (this.outputPipeline) {
         this.outputPipeline.sourceIsInvalid(_data);
      }
      else {
         this.goInvalid(_data);
      }
   }
   else {
      this.goInvalid(_data);
   }
}

// Used internally by derived Property to set a new value for the property (subject to step pipeline processing)
StepProperty.prototype.updatePropertyInternal = function(_newPropValue, _data) {
   this.rawPropertyValue = _newPropValue;
   this.cancelCurrentRamp();

   if (_data == undefined) {
      _data = { sourceName: this.owner.fullName };
   }

   this.checkData(_newPropValue, _data);

   if (this.sourcePipeline) {
      this.sourcePipeline.newInputForProcess(_newPropValue, _data);
   }
   else {
      var propValue = this.transformNewPropertyValue(_newPropValue, _data);

      if (propValue != undefined) {
         _data.value = propValue;
         this.setPropertyInternal(propValue, _data);
      }
   }
};

//
// Derived Properties can use this to be called after the output pipeline has transformed the property value
// This is called after all step pipeline processing is done - after the input and output pipelines (property has been already been set)
// Useful when synchronising an external device with a property value (e.g. gpio out)
// You cannot stop the property changing or change the value, it is for information only
//
StepProperty.prototype.outputStepsComplete = function(_outputValue, _data) {
   // BY DEFAULT, DO NOTHING
};

//
// Called by SourceListener as a defined source has become valid again (available)
// Property can define its policy regarding whether it decides to go valid/invalid
// E.g. it may decide it needs all sources to be valid, or just one
// Override amIValid() to change the standard simple policy based of the config variable this.allSourcesRequiredForValidity
//
StepProperty.prototype.sourceIsValid = function(_data) {
   Property.prototype.sourceIsValid.call(this, _data);

   if (this.pipeline) {
      this.pipeline.sourceIsValid(_data);
   }
}

StepProperty.prototype.setPropertyInternal = function(_newValue, _data) {

   if (this.value !== _newValue || this.cold) {

      if (this.cold) {
         _data.coldStart = true;
         this.cold = false;
      }

      _data.local = this.local;
      this.owner.updateProperty(this.name, _newValue, _data);

      if (this.outputPipeline) {
         this.outputPipeline.newInputForProcess(_newValue, _data);
      }
      else {
         this.outputStepsComplete(_newValue, _data);
      }
      return true;
   }
   else {
      return false;
   }
};

module.exports = exports = StepProperty;
