var util = require('util');
var SourceListener = require('./sourcelistener');
var CasaSystem = require('./casasystem');
var Pipeline = require('./pipeline');

function Property(_config, _owner) {
   this.name = _config.name;
   this.type = _config.type;
   this.uName = _owner.uName+":"+this.type+":"+this.name;

   this.owner = _owner;
   this.allSourcesRequiredForValidity = (_config.hasOwnProperty('allSourcesRequiredForValidity')) ? _config.allSourcesRequiredForValidity : true;
   this.prioritiseSources = _config.prioritiseSources;
   this.value = _config.initialValue;
   this.rawProperyValue = _config.initialValue;
   this.local = (_config.hasOwnProperty('local')) ? _config.local : false;

   this.transform = _config.transform;
   this.transformMap = (_config.transformMap) ? copyData(_config.transformMap) : undefined;

   this.valid = false;
   this.manualMode = false;
   this.cold = true;
   this.hasSourceOutputValues = false;	// Sources can influence the final property value (source in charge)

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

   this.sourceListeners = {};
   this.noOfSources = 0;

   if (_config.source) {
      _config.sources = [_config.source];
   }

   if (_config.sources) {
      this.valid = false;
      this.constructing = true;

      for (var index = 0; index < _config.sources.length; ++index) {
         this.hasSourceOutputValues = this.hasSourceOutputValues || (_config.sources[index].outputValues != undefined);

         if (_config.sources[index].priority == undefined) {
            _config.sources[index].priority = index;
         }

         _config.sources[index].uName = _config.sources[index].name;
         var sourceListener = new SourceListener(_config.sources[index], this);
         this.sourceListeners[sourceListener.sourcePropertyName] = sourceListener;
         this.noOfSources++;
      };

      this.constructing = false;
   }
   else {
      this.valid = true;
   }

   if (_config.hasOwnProperty('target')) {
      this.targetProperty = (_config.hasOwnProperty('targetProperty')) ? _config.targetProperty : "ACTIVE";
      this.ignoreTargetUpdates = (_config.hasOwnProperty('ignoreTargetUpdates')) ? _config.ignoreTargetUpdates : true;
      this.targetListener = new SourceListener({ uName: _config.target, property: this.targetProperty, isTarget: true,
                                                 ignoreSourceUpdates: this.ignoreTargetUpdates, transform: _config.targetTransform,
                                                 transformMap:_config.targetTransformMap}, this);

      this.target = this.targetListener.source;
   }

   this.manualOverrideTimeout = (_config.hasOwnProperty('manualOverrideTimeout')) ? _config.manualOverrideTimeout : 3600;
}

//
// Returns current property value - not updated until all step pipeline has been processed
// *NOTE* The value may be different to what step thinks as many steps can interact with the property
// Steps are encouraged to use this.step.value to understand what they set previously
//
Property.prototype.myValue = function() {
   return this.value;
};

//
// Internal method - dispatch processing to output pipeline
//
Property.prototype.updatePropertyandSendToOutputPipeline = function(_newValue, _data) {
   var propValue = this.transformAndSetProperty(_newValue, _data);

   if (propValue != undefined) {

      if (this.outputPipeline) {
         this.outputPipeline.newInputForProcess(propValue, _data);
      }
      else {
         this.outputStepsComplete(propValue, _data);
      }
   }
};

//
// Internal method - Called by the last step in the pipeline
//
Property.prototype.outputFromPipeline = function(_pipeline, _newValue, _data) {

   if (_pipeline == this.sourcePipeline) {
      console.log(this.uName+": output from source pipeline. Property Value="+_newValue);

      if (this.manualMode) {
         // Copy values to be updated once the manual timer has expired
         this.lastAutoUpdate = { propertyValue: _newValue, data: copyData(_data) };
      }
      else {
         this.updatePropertyandSendToOutputPipeline(_newValue, _data);
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
Property.prototype.sourceIsValidFromPipeline = function(_pipeline, _data) {

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
Property.prototype.sourceIsInvalidFromPipeline = function(_pipeline, _data) {

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
Property.prototype.updatePropertyInternal = function(_newPropValue, _data) {
   this.rawProperyValue = _newPropValue;

   if (_data == undefined) {
      _data = { sourceName: this.owner.uName };
   }

   this.checkData(this, _newPropValue, _data);

   if (this.sourcePipeline) {
      this.sourcePipeline.newInputForProcess(_newPropValue, _data);
   }
   else if (this.manualMode) {
      // Copy property change - will be sent once the manual timer has expired
      this.lastAutoUpdate = { propertyValue: _newPropValue, data: copyData(_data) };
   }
   else {
      this.updatePropertyandSendToOutputPipeline(_newPropValue, _data);
   }
};

//
// Used to set the property directly, ignoring the defined sources and input step pipeline processing
// Using this method wil place the property in manual mode (it will ignore any sources for a defined period)
// Output step pipeline still executes
//
Property.prototype.set = function(_propValue, _data) {
   this.setManualMode(true);
   _data.manualPropertyChange = true;

   this.updatePropertyandSendToOutputPipeline(_propValue, _data);
   return true;
};

//
// Place the property in/out manual mode
// in manual mode - ignore events from all defined sources for a period when in manual mode
//                - input step pipeline effectively disabled
//                - output step pipeline (and setProperty() ) still enabled
//
Property.prototype.setManualMode = function(_manualMode) {

   if (_manualMode) {
      this.restartManualOverrideTimer();
   }
   else if (this.manualOverrideTimer) {
      clearTimeout(this.manualOverrideTimer);
   }

   if (this.manualMode != _manualMode) {
      this.manualMode = _manualMode;

      if (!_manualMode) {
         this.leaveManualMode();
      }
   }
};

//
// Property should come out of manual mode
// in manual mode - ignore events from all defined sources for a period when in manual mode
// Coming out, latest property automatic aupdate should be applied, if it was received while in manual mode
//
Property.prototype.leaveManualMode = function() {

   if (this.lastAutoUpdate) {
      this.updatePropertyandSendToOutputPipeline(this.lastAutoUpdate.propertyValue, this.lastAutoUpdate.data);
      this.lastAutoUpdate = null;
   }
};

//
// Derived Properties can use this to be called after the output pipeline has transformed the property value
// This is called after all step pipeline processing is done - after the input and output pipelines (property has been already been set)
// Useful when synchronising an external device with a property value (e.g. gpio out)
// You cannot stop the property changing or change the value, it is for information only
//
Property.prototype.outputStepsComplete= function(_outputPipelineValue, _data) {
   // BY DEFAULT, DO NOTHING
};

//
// Derived Properties can use this to be called just before the prooperty is changed
// This is called after the input step pipeline processing has been done - just before the property is set
// Useful when synchronising an external device with a property value (e.g. gpio in)
// You cannot stop the property changing or change the value, it is for information only
//
Property.prototype.propertyAboutToChange = function(actualOutputValue, _data) {
   // BY DEFAULT, DO NOTHING
};


//
// Defines policy for property validity
// Simple policy based of validity of defined sources and config variable this.allSourcesRequiredForValidity
//
Property.prototype.amIValid = function() {

   if (this.allSourcesRequiredForValidity) {

      return (allAssocArrayElementsDo(this.sourceListeners, function(_sourceListener) {
            return _sourceListener.valid;
      }));
   }
   else {
      return (anyAssocArrayElementsDo(this.sourceListeners, function(_sourceListener) {
            return _sourceListener.valid;
      }));
   }
};

//
// Called by SourceListener as a defined source has become valid again (available)
// Property can define its policy regarding whether it decides to go valid/invalid
// E.g. it may decide it needs all sources to be valid, or just one
// Override isValid() to change the standard simple policy based of the config variable this.allSourcesRequiredForValidity
//
Property.prototype.sourceIsValid = function(_data) {

   var oldValid = this.valid;
   this.valid = this.amIValid();
   this.target = (this.targetListener) ? this.targetListener.source : null;

   if (this.pipeline) {
      this.pipeline.sourceIsValid(_data);
   }
}

//
// Internal function can be called by derived properties
// Actual tell all listening parties that this proerty is now invalid
// Some properties wish to delay or stop this and become responsible for calling this function
// when they override Property.prototype.sourceIsInvalid()
//
Property.prototype.goInvalid = function (_data) {
   console.log(this.uName + ': INVALID');
   this.owner.goInvalid(this.name, _data);
}

Property.prototype.goValid = function (_data) {
}

//
// Called by SourceListener as a defined source has become invalid (unavailable)
// Property can define its policy regarding whether it decides to go valid/invalid
// E.g. it may decide it needs all sources to be valid, or just one
// Override isValid() to change the standard simple policy based of the config variable this.allSourcesRequiredForValidity
//
Property.prototype.sourceIsInvalid = function(_data) {

   var oldValid = this.valid;
   this.valid = this.amIValid();

   // Has the valid stated changed from true to false?
   if (oldValid && !this.valid) {
      this.target = null;

      if (this.pipeline) {
         this.pipeline.sourceIsValid(_data);
      }
   }
};

//
// Called by SourceListener as a defined source has changed it property value
// Will invoke this property processing followed by the step pipeline processing
//     - only if the property is valid and not in manual mode
//
Property.prototype.sourcePropertyChanged = function(_data) {

   var that = this;

   if (this.valid) {

      if (this.sourceListeners[_data.sourcePropertyName]) {

         if (this.manualMode) {  // In manual override mode, copy data
            this.lastData = copyData(_data);
         }
         else {
            this.newPropertyValueReceivedFromSource(this.sourceListeners[_data.sourcePropertyName], _data);
         }
      }
   }
};

//
// Called by SourceListener (Target) as the defined target has changed it property value
//   -- only works if target config ignoreTargetUpdates is set to false (default is true)
// Also called by Manual Override Controller to override defined sources
//
Property.prototype.targetPropertyChanged = function(_data) {

   if (this.valid) {

      if (this.targetListener && this.targetListener.sourcePropertyName == _data.sourcePropertyName) {
         this.newPropertyValueReceivedFromTarget(this.targetListener, _data);
      }
   }
};

//
// Derived Properties should override this to process property changes from defined sources
// If the property wants to update its value, it should call this.updatePropertyInternal() method
// This will then invoke the input step pipeline processing followed by the output step pipleline processing
// Only then will the property value be set
// *NOTE* the final value will probably differ because of the step pipleline processing
//  --- Use this.rawProperyValue to access previous value set (no affected by step pipeline processing)
//
Property.prototype.newPropertyValueReceivedFromSource = function(_sourceListener, _data) {
   this.updatePropertyInternal(_data.propertyValue, _data);
};

Property.prototype.newPropertyValueReceivedFromTarget = function(_targetListener, _data) {
   // DO NOTHING BY DEFAULT
};

// Override this if you listen to a source that is not "Source".
// If you listen to a "Source" you will be fired by that Source cold starting
Property.prototype.coldStart = function(_data) {
};

// ====================
// INTERNAL METHODS
// ====================

Property.prototype.transformAndSetProperty = function(_newValue, _data) {

   var actualOutputValue = this.transformNewPropertyValue(_newValue, _data);
   _data.propertyValue = actualOutputValue;

   if (this.value !== actualOutputValue || this.cold) {

      if (this.cold) {
         _data.coldStart = true;
         this.cold = false;
      }

      _data.local = this.local;
      this.propertyAboutToChange(actualOutputValue, _data);
      this.owner.updateProperty(this.name, actualOutputValue, _data);
      return actualOutputValue;
   }
   else {
      return undefined;
   }
};

Property.prototype.findHighestPrioritySource = function(_sourcePropertyValue) {
   var highestPriorityFound = 99999;
   var highestPrioritySource = null;

   for (var sourcePropertyName in this.sourceListeners) {

      if (this.sourceListeners.hasOwnProperty(sourcePropertyName)){
         var sourceListener = this.sourceListeners[sourcePropertyName];

         if (sourceListener && sourceListener.valid && (sourceListener.priority < highestPriorityFound) && (sourceListener.sourcePropertyValue == _sourcePropertyValue)) {
            highestPriorityFound = sourceListener.priority;
            highestPrioritySource = sourceListener;
         }
      }
   }

   return highestPrioritySource;
};

Property.prototype.transformNewPropertyValueBasedOnSource = function(_newPropValue, _data) {
   var actualOutputValue = _newPropValue;

   if (_data.sourcePropertyName != undefined) {
      var sourceListener = this.sourceListeners[_data.sourcePropertyName];

      if (sourceListener) {
         var sourceListenerInCharge = sourceListener;

         if (this.prioritiseSources) {
            var highestPrioritySource = this.findHighestPrioritySource(_newPropValue);

            if (highestPrioritySource) {
               sourceListenerInCharge = highestPrioritySource;
            }
         }
         if (sourceListenerInCharge.outputValues && sourceListenerInCharge.outputValues[actualOutputValue] != undefined) {
            actualOutputValue = sourceListenerInCharge.outputValues[actualOutputValue];
         }
      }
   }

   return actualOutputValue;
};

// *** TODO Move this to its own step2
Property.prototype.transformNewPropertyValue = function(_newPropValue, _data) {
   var actualOutputValue = this.transformNewPropertyValueBasedOnSource(_newPropValue, _data);

   // Apply Output Transform
   if (this.transform || this.transformMap) {
      var output = actualOutputValue;
      var newOutput = output;

      if (this.transform) {
         var exp = this.transform.replace(/\$value/g, "output");
         eval("newOutput = " + exp);
      }

      if (this.transformMap && this.transformMap[newOutput] != undefined) {
         newOutput = this.transformMap[newOutput];
      }

      actualOutputValue = newOutput;
   }

   return actualOutputValue;
}

Property.prototype.restartManualOverrideTimer = function() {

   if (this.manualOverrideTimer) {
      clearTimeout(this.manualOverrideTimer);
   }

   this.manualOverrideTimer = setTimeout(function(_that) {
      _that.manualOverrideTimer = null;
      _that.setManualMode(false);
   }, this.manualOverrideTimeout*1000, this);
};

function copyData(_sourceData) {
   var newData = {};

   for (var prop in _sourceData) {

      if (_sourceData.hasOwnProperty(prop)){
         newData[prop] = _sourceData[prop];
      }
   }

   return newData;
}

function allAssocArrayElementsDo(_obj, _func) {
   
   for (var prop in _obj) {

      if (_obj.hasOwnProperty(prop)){
         if (!_func(_obj[prop])) {
            return false;
         }
      }
   }
   return true;
}

function anyAssocArrayElementsDo(_obj, _func) {

   for (var prop in _obj) {

      if (_obj.hasOwnProperty(prop)){
         if (_func(_obj[prop])) {
            return true;
         }
      }
   }
   return false;
}

Property.prototype.checkData = function(_this, _value, _data) {

   if (_data.sourceName == undefined) _data.sourceName = this.owner.uName;
   if (_data.sourceName == undefined) _data.sourceName = this.owner.uName;
   if (_data.properyName == undefined) _data.propertyName = this.name;
   if (_data.properyValue == undefined) _data.propertyValue = _value;
}

module.exports = exports = Property;
