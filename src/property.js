var util = require('util');
var SourceListener = require('./sourcelistener');
var CasaSystem = require('./casasystem');

function Property(_config, _owner) {
   this.name = _config.name;
   this.type = _config.type;
   this.uName = _owner.uName+":"+this.type+":"+this.name;

   this.writeable = (_config.writeable) ? _config.writeable : true;
   this.owner = _owner;
   this.allSourcesRequiredForValidity = (_config.allSourcesRequiredForValidity) ? _config.allSourcesRequiredForValidity : true;  //****** TODO Check all properties for this *******
   this.prioritiseSources = _config.prioritiseSources;
   this.value = _config.initialValue;
   this.rawProperyValue = _config.initialValue;

   this.outputTransform = _config.outputTransform;
   this.outputMap = (_config.outputMap) ? copyData(_config.outputMap) : undefined;

   this.valid = false;
   this.manualMode = false;
   this.cold = true;
   this.hasSourceOutputValues = false;	// Sources can influence the final property value (source in charge)

   loadSteps(this, _config);

   this.sourceListeners = {};
   this.noOfSources = 0;

   if (_config.source) {
      _config.sources = [{ name: _config.source, property: _config.sourceProperty, uName: _config.source+":"+_config.sourceProperty }];
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

   if (_config.target) {
      this.targetProperty = (_config.targetProperty) ? _config.targetProperty : "ACTIVE";
      this.ignoreTargetUpdates = (_config.ignoreTargetUpdates == undefined) ? true : _config.ignoreTargetUpdates;
      this.targetListener = new SourceListener({ uName: _config.target, property: this.targetProperty, isTarget: true,
                                                 ignoreSourceUpdates: this.ignoreTargetUpdates, inputTransform: _config.targetInputTransform,
                                                 inputMap:_config.targetInputMap}, this);

      this.target = this.targetListener.source;
   }

   this.manualOverrideTimeout = (_config.manualOverrideTimeout) ? _config.manualOverrideTimeout : 3600;

   if (_config.manualOverrideSource) {
      this.manualOverrideSourceProperty = (_config.manualOverrideSourceProperty) ? _config.manualOverrideSourceProperty : "ACTIVE";
      this.manualOverrideListener = new SourceListener({ uName: _config.manualOverrideSource, sourceProperty: this.manualOverrideSourceProperty, isTarget: true,
                                                         ignoreSourceUpdates: false, inputTransform: _config.manualOverrideSourceInputTransform,
                                                         inputMap:_config.manualOverrideSourceInputMap}, this);

      this.manualOverrideSource = this.manualOverrideListener.source;
   }

   this.listening = true;
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
// Internal method - Called by the last step in the pipeline
// * DO NOT CALL DIRECTLY *
// Use updatePropertyInternal() to kick off step pipleline
//
Property.prototype.process = function(_newValue, _data) {

   if (_data == undefined) {
      _data = { sourceName: this.owner.uName };
   }

   var actualOutputValue = transformNewPropertyValueBasedOnSource(this, _newValue, _data);

   if (this.myValue() !== actualOutputValue || this.cold) {

      if (this.cold) {
         _data.coldStart = true;
         this.cold = false;
      }

      this.propertyAboutToChange(actualOutputValue, _data);
      this.owner.updateProperty(this.name, actualOutputValue, _data);
   }
};

// Used internally by derived Property to set a new value for the property (subject to step pipeline processing)
Property.prototype.updatePropertyInternal = function(_newPropValue, _data) {
   this.rawProperyValue = _newPropValue;

   if (_data == undefined) {
      _data = { sourceName: this.owner.uName };
   }
   ((this.stepPipeline) ? this.stepPipeline : this).process(_newPropValue, _data);
};

//
// Used to set the property directly, ignoring the defined sources and input step pipeline processing
// Output step pipeline still executes
//
Property.prototype.setProperty = function(_propValue, _data) {

   if (this.writeable) {
      this.setManualMode(true);
      ((this.outputPipeline != null) ? this.outputPipeline : this).process(_propValue, _data);
   }

   return this.writeable;
};

//
// Place the property in/out manual mode
// in manual mode - ignore events from all defined sources for a period when in manual mode
//                - input step pipeline effectively disabled
//                - output step pipeline (and setProperty() ) still enabled
//
Property.prototype.setManualMode = function(_manualMode) {
   this.manualMode = _manualMode;

   if (_manualMode) {
      this.listening = false;
      restartManualOverrideTimer(this);
   }
   else {
      this.listening = true;

      if (this.manualOverrideTimer) {
         clearTimeout(this.manualOverrideTimer);
      }

      if (this.lastData) {
         this.newPropertyValueReceivedFromSource(this.sourceListeners[this.lastData.sourcePropertyName], this.lastData);
         this.lastData = null;
      }
   }
};

//
// Derived Properties can use this to be called just before the prooperty is changed
// This is called after all step pipeline processing is done
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

   this.manualOverrideSource = (this.manualOverrideListener) ? this.manualOverrideListener.source : null;

   if (!this.manualOverrideSource) {
      this.setMan
      this.listening = true;
   }

   if (!oldValid && this.valid) {
      this.sourcePropertyChanged(_data);
   }
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
      // If so, tell the others guys that I am now invalid
      console.log(this.uName + ': INVALID');

      this.target = null;
      this.manualOverrideSource = null;
      this.owner.goInvalid(this.name, _data);
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

      if (!this.listening) {  // In manual override mode

         if (this.sourceListeners[_data.sourcePropertyName]) {
            this.lastData = copyData(_data);
         }
         else {  // Must have come from manual override source
            restartManualOverrideTimer(this);
            this.updatePropertyInternal(_data.propertyValue, _data);
         }
      }
      else {
         if (this.sourceListeners[_data.sourcePropertyName]) {
            this.newPropertyValueReceivedFromSource(this.sourceListeners[_data.sourcePropertyName], _data);
         }
         else {  // Must have come from manual override source
            this.setManualMode(true);
            this.updatePropertyInternal(_data.propertyValue, _data);
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
      else if (this.manualOverrideListener.sourcePropertyName == _data.sourcePropertyName && !this.manualMode) {
         processManualOverridePropertyChange(this, this.manualOverrideListener, _data);
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
   this.updatePropertyInternal(this.value, { sourceName: this.owner.uName, coldStart: true });
};

// ====================
// NON-EXPORTED METHODS
// ====================

function loadSteps(_this, _config) {
   _this.inputSteps = [];
   _this.outputSteps = [];

   _this.stepPipeline = null;
   _this.outputPipeline = null;

   var previousStep = null;
   var step = null;

   if (_config.inputSteps != undefined) {

      for (var i = 0; i < _config.inputSteps.length; ++i) {
         var Step = require('./'+_config.inputSteps[i].type);
         step = new Step(_config.inputSteps[i], _this);
         _this.inputSteps.push(step);

         if (i > 0) {
            previousStep.setNextStep(step);
         }
         else {
            _this.stepPipeline = step;
         }

         previousStep = step;
      }
   }

   if (_config.outputSteps != undefined) {

      for (var j = 0; j < _config.outputSteps.length; ++j) {
         var Step = require('./'+_config.outputSteps[j].type);
         step = new Step(_config.outputSteps[j], _this);
         _this.outputSteps.push(step);

         if (j > 0) {
            previousStep.setNextStep(step);
            previousStep = step;
         }
         else {
            _this.outputPipeline = step;

            if (_this.stepPipeline == null) {
               _this.stepPipeline = _this.outputPipeline;
            }
         }
      }
   }

   if (step) {
      step.setNextStep(_this);
   }
}

function processManualOverridePropertyChange(_this, _manualOverrideListener, _data) {
   _this.listening = _data.sourcePropertyValue;
};

function findHighestPrioritySource(_this, _sourcePropertyValue) {
   var highestPriorityFound = 99999;
   var highestPrioritySource = null;

   for (var sourcePropertyName in _this.sourceListeners) {

      if (_this.sourceListeners.hasOwnProperty(sourcePropertyName)){
         var sourceListener = _this.sourceListeners[sourcePropertyName];

         if (sourceListener && sourceListener.valid && (sourceListener.priority < highestPriorityFound) && (sourceListener.sourcePropertyValue == _sourcePropertyValue)) {
            highestPriorityFound = sourceListener.priority;
            highestPrioritySource = sourceListener;
         }
      }
   }

   return highestPrioritySource;
}

function transformNewPropertyValueBasedOnSource(_this, _newPropValue, _data) {
   var actualOutputValue = _newPropValue;

   if (_data.sourcePropertyName != undefined) {
      var sourceListener = (_data.sourcePropertyName != undefined) ? _this.sourceListeners[_data.sourcePropertyName] : undefined;

      if (sourceListener) {
         var sourceListenerInCharge = sourceListener;

         if (_this.prioritiseSources) {
            var highestPrioritySource = findHighestPrioritySource(_this, _newPropValue);

            if (highestPrioritySource && (highestPrioritySource.priority >= sourceListener.priority)) {
               sourceListenerInCharge = highestPrioritySource;
            }
         }

         if (sourceListenerInCharge.outputValues && sourceListenerInCharge.outputValues[actualOutputValue] != undefined) {
            actualOutputValue = sourceListenerInCharge.outputValues[actualOutputValue];
         }
      }
   }

   return actualOutputValue;
}

// *** TODO Move this to its own step2
function transformNewPropertyValue(_this, _newPropValue, _data) {
   var actualOutputValue = transformNewPropertyValueBasedOnSource(_this, _newPropValue, _data);

   // Apply Output Transform
   if (_this.outputTransform || _this.outputMap) {
      var output = actualOutputValue;
      var newOutput = output;

      if (_this.outputTransform) {
         var exp = _this.outputTransform.replace(/\$value/g, "output");
         eval("newOutput = " + exp);
      }

      if (_this.outputMap && _this.outputMap[newOutput] != undefined) {
         newOutput = _this.outputMap[newOutput];
      }

      actualOutputValue = newOutput;
   }

   return actualOutputValue;
}

function restartManualOverrideTimer(_this) {

   if (_this.manualOverrideTimer) {
      clearTimeout(_this.manualOverrideTimer);
   }

   _this.manualOverrideTimer = setTimeout(function(_that) {
      _that.manualOverrideTimer = null;
      _that.setManualMode(false);
   }, _this.manualOverrideTimeout*1000, _this);
}

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

module.exports = exports = Property;