var util = require('./util');
var SourceListener = require('./sourcelistener');
var Pipeline = require('./pipeline');
var NamedObject = require('./namedobject');

function Property(_config, _owner) {
   NamedObject.call(this, _config, _owner);

   this.owner = _owner;
   this.allSourcesRequiredForValidity = (_config.hasOwnProperty('allSourcesRequiredForValidity')) ? _config.allSourcesRequiredForValidity : true;
   this.initialValueSet = _config.hasOwnProperty("initialValue");
   this.value = _config.initialValue;
   this.rawPropertyValue = _config.initialValue;
   this.local = (_config.hasOwnProperty('local')) ? _config.local : false;

   if (_config.hasOwnProperty('transform')) {
      this.transform = _config.transform;
   }

   if (_config.hasOwnProperty('transformMap')) {
      this.transformMap = util.copy(_config.transformMap);
   }

   this.valid = false;
   this.cold = true;
   this.hasSourceOutputValues = false;	// Sources can influence the final property value (source in charge)

   this.sourceListeners = {};
   this.noOfSources = 0;

   if (_config.hasOwnProperty('source')) {
      _config.sources = [_config.source];
   }

   if (_config.hasOwnProperty('sources')) {
      this.valid = false;

      for (var index = 0; index < _config.sources.length; ++index) {
         this.hasSourceOutputValues = this.hasSourceOutputValues || (_config.sources[index].hasOwnProperty('outputValues'));

         if (!_config.sources[index].hasOwnProperty("uName") || _config.sources[index].uName == undefined) {
            _config.sources[index].uName = this.owner.uName;
         }

         var sourceListener = new SourceListener(_config.sources[index], this);
         this.sourceListeners[sourceListener.sourceEventName] = sourceListener;
         this.noOfSources++;
      }
   }
   else {
      this.valid = true;
   }

   if (_config.hasOwnProperty('target')) {
      _config.target.uName = (_config.target.hasOwnProperty("uName")) ? _config.target.uName : this.owner.uName;
      this.targetProperty = (_config.hasOwnProperty('targetProperty')) ? _config.targetProperty : "ACTIVE";
      this.ignoreTargetUpdates = (_config.hasOwnProperty('ignoreTargetUpdates')) ? _config.ignoreTargetUpdates : true;

      this.targetListener = new SourceListener({ uName: _config.target, property: this.targetProperty, isTarget: true,
                                                 ignoreSourceUpdates: this.ignoreTargetUpdates, transform: _config.targetTransform,
                                                 transformMap:_config.targetTransformMap}, this);

      this.target = this.targetListener.source;
   }
}

util.inherits(Property, NamedObject);

//
// Returns current property value - not updated until all step pipeline has been processed
// *NOTE* The value may be different to what step thinks as many steps can interact with the property
// Steps are encouraged to use this.step.value to understand what they set previously
//
Property.prototype.getValue = function() {
   return this.value;
};

// Used internally by derived Property to set a new value for the property (subject to step pipeline processing)
Property.prototype.updatePropertyInternal = function(_newPropValue, _data) {
   this.rawPropertyValue = _newPropValue;
   this.cancelCurrentRamp();

   if (_data == undefined) {
      _data = { sourceName: this.owner.uName };
   }

   this.checkData(_newPropValue, _data);

   var propValue = this.transformNewPropertyValue(_newPropValue, _data);

   _data.value = propValue;
   this.setPropertyInternal(propValue, _data);
};

//
// Used to set the property directly, ignoring the defined sources and input step pipeline processing
// Output step pipeline still executes
//
Property.prototype.set = function(_propValue, _data) {
   this.cancelCurrentRamp();
   this.setPropertyInternal(_propValue, _data);
   return true;
};

//
// Used to set the property directly, ignoring the defined sources and input step pipeline processing
// Instead of specifying a value, specify a config for the ramp
// Output step pipeline still executes
//
Property.prototype.setWithRamp = function(_config, _data) {
   this.cancelCurrentRamp();
   this.createAndStartRamp(_config, _data);
};

Property.prototype.createAndStartRamp = function(_config, _data) {
   this.rampConfig = util.copy(_config);

   if (_config.hasOwnProperty("ramps")) {
      this.rampConfig.ramps = util.copy(_config.ramps, true);
   }
   this.rampData = util.copy(_data);
   this.ramp = this.owner.getRampService().createRamp(this, this.rampConfig);
   this.ramp.start(this.value);
};

Property.prototype.cancelCurrentRamp = function() {

   if (this.ramp) {
      this.ramp.cancel();
      delete this.ramp;
      delete this.rampConfig;
      this.ramp = null;
      this.rampConfig = null;
      this.rampData = null;
   }
};

Property.prototype.newValueFromRamp = function(_ramp, _config, _value) {
   console.log(this.uName + ": New value from ramp, property=" + this.name + ", value=" + _value);
   this.setPropertyInternal(_value, this.rampData);
};

Property.prototype.rampComplete = function(_ramp, _config) {
   delete this.ramp;
   delete this.rampConfig;
   this.ramp = null;
   this.rampConfig = null;
   this.rampData = null;
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
// Override this to create a more complex policy
//
Property.prototype.amIValid = function() {

   if (this.allSourcesRequiredForValidity) {

      return (util.allAssocArrayElementsDo(this.sourceListeners, function(_sourceListener) {
            return _sourceListener.isValid();
      }));
   }
   else {
      return (util.anyAssocArrayElementsDo(this.sourceListeners, function(_sourceListener) {
            return _sourceListener.isValid();
      }));
   }
};

//
// Called by SourceListener as a defined source has become valid again (available)
// Property can define its policy regarding whether it decides to go valid/invalid
// E.g. it may decide it needs all sources to be valid, or just one
// Override amIValid() to change the standard simple policy based of the config variable this.allSourcesRequiredForValidity
//
Property.prototype.sourceIsValid = function(_data) {
   var oldValid = this.valid;
   this.valid = this.amIValid();
   this.target = (this.targetListener) ? this.targetListener.source : null;
}

//
// Internal function can be called by derived properties
// Actual tell all listening parties that this proerty is now invalid
// Some properties wish to delay or stop this and become responsible for calling this function
// when they override Property.prototype.sourceIsInvalid()
//
Property.prototype.invalidate = function (_includeChildren) {
   console.log(this.uName + ': INVALID');
   this.owner.propertyGoneInvalid(this.name);
   NamedObject.prototype.invalidate.call(this);
   this.cancelCurrentRamp();
}

Property.prototype.goValid = function (_data) {
}

//
// Called by SourceListener as a defined source has become invalid (unavailable)
// Property can define its policy regarding whether it decides to go valid/invalid
// E.g. it may decide it needs all sources to be valid, or just one
// Override amIValid() to change the standard simple policy based of the config variable this.allSourcesRequiredForValidity
//
Property.prototype.sourceIsInvalid = function(_data) {
   console.log(this.uName + ': Property.prototype.sourceIsInvalid');

   var oldValid = this.valid;
   this.valid = this.amIValid();

   // Has the valid stated changed from true to false?
   if (oldValid && !this.valid) {
      this.target = null;
      this.invalidate();
   }
};

//
// Called by SourceListener as a defined source has changed it property value
// Will invoke this property processing followed by the step pipeline processing
//
Property.prototype.receivedEventFromSource = function(_data) {

   if (this.valid) {

      if (this.sourceListeners[_data.sourceEventName]) {
         this.newEventReceivedFromSource(this.sourceListeners[_data.sourceEventName], _data);
      }
   }
};

//
// Called by SourceListener (Target) as the defined target has changed it property value
//   -- only works if target config ignoreTargetUpdates is set to false (default is true)
//
Property.prototype.receivedEventFromTarget = function(_data) {

   if (this.valid) {

      if (this.targetListener && this.targetListener.sourceEventName == _data.sourceEventName) {
         this.newEventReceivedFromTarget(this.targetListener, _data);
      }
   }
};

//
// Derived Properties should override this to process property changes from defined sources
// If the property wants to update its value, it should call this.updatePropertyInternal() method
// This will then invoke the input step pipeline processing followed by the output step pipleline processing
// Only then will the property value be set
// *NOTE* the final value will probably differ because of the step pipleline processing
//  --- Use this.rawPropertyValue to access previous value set (no affected by step pipeline processing)
//
Property.prototype.newEventReceivedFromSource = function(_sourceListener, _data) {
   this.updatePropertyInternal(_data.value, _data);
};

Property.prototype.newEventReceivedFromTarget = function(_targetListener, _data) {
   // DO NOTHING BY DEFAULT
};

// Override this if you listen to a source that is not "Source".
// If you listen to a "Source" you will be fired by that Source cold starting
Property.prototype.coldStart = function(_data) {

   if (this.initialValueSet) {
      console.log(this.uName + ": Cold starting, emiting initialValue="+this.value);
      this.cold = false;
      this.owner.emitPropertyChange(this.name, this.value, { sourceName: this.owner.uName, coldStart: true });
   }
};

// ====================
// INTERNAL METHODS
// ====================

Property.prototype.setPropertyInternal = function(_newValue, _data) {
   console.log(this.uName + ": setPropertyInternal value="+_newValue);

   if (this.value !== _newValue || this.cold) {

      if (this.cold) {
         _data.coldStart = true;
         this.cold = false;
      }

      _data.local = this.local;
      this.owner.updateProperty(this.name, _newValue, _data);
      return true;
   }
   else {
      return false;
   }
};

Property.prototype.transformNewPropertyValue = function(_newPropValue, _data) {
   // Transform new property value based on source
   var actualOutputValue = _newPropValue;

   if (_data.hasOwnProperty('sourceEventName')) {
      var sourceListener = this.sourceListeners[_data.sourceEventName];

      if (sourceListener && sourceListener.outputValues && sourceListener.outputValues.hasOwnProperty(actualOutputValue)) {
         actualOutputValue = sourceListener.outputValues[actualOutputValue];
      }
   }

   // Apply Output Transform
   if (this.transform || this.transformMap) {
      var output = actualOutputValue;
      var newOutput = output;

      if (this.transform) {
         var exp = this.transform.replace(/\$value/g, "output");
         eval("newOutput = " + exp);
      }

      if (this.transformMap && this.transformMap.hasOwnProperty(newOutput)) {
         newOutput = this.transformMap[newOutput];
      }

      actualOutputValue = newOutput;
   }

   return actualOutputValue;
}

Property.prototype.checkData = function(_value, _data) {

   if (!_data.hasOwnProperty('sourceName')) _data.sourceName = this.owner.uName;
   if (!_data.hasOwnProperty('name')) _data.name = this.name;
   if (!_data.hasOwnProperty('value')) _data.value = _value;
}

module.exports = exports = Property;
