var util = require('./util');
var SourceListener = require('./sourcelistener');
var NamedObject = require('./namedobject');

function Property(_config, _owner) {
   NamedObject.call(this, _config, _owner);

   this.owner = _owner;
   this.allSourcesRequiredForValidity = (_config.hasOwnProperty('allSourcesRequiredForValidity')) ? _config.allSourcesRequiredForValidity : true;
   this.ignoreInvalid = _config.hasOwnProperty("ignoreInvalid") ? _config.ignoreInvalid : false;
   this.initialValueSet = _config.hasOwnProperty("initialValue");
   this.value = _config.initialValue;
   this.rawPropertyValue = _config.initialValue;
   this.local = (_config.hasOwnProperty('local')) ? _config.local : false;

   if (_config.hasOwnProperty("generateNewTransaction")) {
      this.generateNewTransaction = _config.generateNewTransaction;
   }

   if (_config.hasOwnProperty('transform')) {
      this.transform = _config.transform;
   }

   if (_config.hasOwnProperty('transformMap')) {
      this.transformMap = util.copy(_config.transformMap);
   }

   if (_config.hasOwnProperty("alwaysUpdate")) {
      this.alwaysUpdate = _config.alwaysUpdate;
   }

   var parent = { public: true, protected: false, private: false, parent: true, children: false, both: true };
   var child = { public: true, protected: true, private: false, parent: false, children: true, both: true };

   if (_config.hasOwnProperty('ignorePropagation')) {
      this.ignoreParent = parent.hasOwnProperty(_config.ignorePropagation) ? parent[_config.ignorePropagation] : false;
      this.ignoreChildren = child.hasOwnProperty(_config.ignorePropagation) ? child[_config.ignorePropagation] : false;
   }
   else {
      if (_config.hasOwnProperty('ignoreParent')) this.ignoreParent = _config.ignoreParent;
      if (_config.hasOwnProperty('ignoreChildren')) this.ignoreChildren = _config.ignoreChildren;
   }

   if (_config.hasOwnProperty('propagation')) {
      this.propagateToParent = parent.hasOwnProperty(_config.propagation) ? parent[_config.propagation] : true;
      this.propagateToChildren = child.hasOwnProperty(_config.propagation) ? child[_config.propagation] : true;
   }
   else {
      if (_config.hasOwnProperty('propagateToParent')) this.propagateToParent = _config.propagateToParent;
      if (_config.hasOwnProperty('propagateToChildren')) this.propagateToChildren = _config.propagateToChildren;
   }

   this.valid = false;
   this.cold = true;
   this.hasSourceOutputValues = false;	// Sources can influence the final property value (source in charge)

   this.sourceListeners = {};

   if (_config.hasOwnProperty('source')) {
      _config.sources = [_config.source];
   }

   if (_config.hasOwnProperty('sources')) {
      this.valid = false;

      for (var index = 0; index < _config.sources.length; ++index) {
         this._addSource(_config.sources[index]);
      }
   }
   else {
      this.valid = true;
   }

   if (this.owner.gang.casa) {
      this.owner.gang.casa.scheduleRefreshSourceListeners();
   }
}

util.inherits(Property, NamedObject);

// Used to classify the type and understand where to load the javascript module
Property.prototype.superType = function(_type) {
   return "property";
};

// Called when system state is required
Property.prototype.export = function(_exportObj) {
   NamedObject.prototype.export.call(this, _exportObj);
   _exportObj.value = this.value;
   _exportObj.rawPropertyValue = this.rawPropertyValue;
   _exportObj.cold = this.cold;
   _exportObj.valid = this.valid;
};

// Called before hotStart to restore system state
Property.prototype.import = function(_importObj) {
   NamedObject.prototype.import.call(this, _importObj);
   this.value = _importObj.value;
   this.rawPropertyValue = _importObj.rawPropertyValue;
   this.cold = _importObj.cold;
   this.valid = _importObj.valid;
};

// Override this if you listen to a source that is not "Source".
// If you listen to a "Source" you will be fired by that Source cold starting
Property.prototype.coldStart = function(_data) {

   if (this.initialValueSet) {
      console.log(this.uName + ": Cold starting, emiting initialValue="+this.value);
      this.cold = false;
      this.checkTransaction();
      this.owner.updateProperty(this.name, this.value, { sourceName: this.owner.uName, coldStart: true });
   }

   NamedObject.prototype.coldStart.call(this, _data);
};

// Override this if you listen to a source that is not "Source".
// If you listen to a "Source" you will be fired by that Source cold starting
Property.prototype.hotStart = function() {
   NamedObject.prototype.hotStart.call(this);
};

Property.prototype.checkTransaction = function() {

   if (this.generateNewTransaction) {
      this.owner.newTransaction();
   }
};

Property.prototype.getCasa = function() {
   return this.owner.getCasa();
};

// Add a new source to the property - not persisted
Property.prototype.addNewSource = function(_config) {
   var sourceListener = new SourceListener(_config, this);
   this.sourceListeners[sourceListener.sourceEventName] = sourceListener;
   sourceListener.refreshSource();
};

//
// Returns current property value 
//
Property.prototype.getValue = function() {
   return this.value;
};

//
// Should we update even though the values are the same?
//
Property.prototype.alwaysUpdate = function() {
   return this.hasOwnProperty("alwaysUpdate") && this.alwaysUpdate;
};

// Used internally by derived Property to set a new value for the property
Property.prototype.updatePropertyInternal = function(_newPropValue, _data) {
   this.rawPropertyValue = _newPropValue;
   this.cancelCurrentRamp();

   if (_data == undefined) {
      _data = { sourceName: this.owner.uName };
   }

   this.checkData(_newPropValue, _data);

   var propValue = this.transformNewPropertyValue(_newPropValue, _data);

   _data.value = propValue;
   this.checkTransaction();
   this.setPropertyInternal(propValue, _data);
};

//
// Used to set the property directly
//
Property.prototype.set = function(_propValue, _data) {
   this.cancelCurrentRamp();
   this.checkTransaction();
   this.setPropertyInternal(_propValue, _data);
   return true;
};

//
// Used to set the property directly
// Instead of specifying a value, specify a config for the ramp
//
Property.prototype.setWithRamp = function(_config, _data) {
   this.cancelCurrentRamp();
   this.checkTransaction();
   this.createAndStartRamp(_config, _data);
};

Property.prototype.createAndStartRamp = function(_config, _data) {
   this.rampConfig = util.copy(_config);

   if (_config.hasOwnProperty("ramps")) {
      this.rampConfig.ramps = util.copy(_config.ramps, true);
   }
   this.rampData = util.copy(_data);

   if (!this.rampData.hasOwnProperty("transaction")) {
      this.rampData.transaction = this.owner.checkTransaction();
   }

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
   var transaction = this.owner.modifyTransaction("R");

   if (!this.rampData) {
      this.rampData = { transaction: this.owner.modifyTransaction("R")};
   }
   else {
      this.rampData.transaction = this.rampData.hasOwnProperty("transaction") ? this.rampData.transaction + "R" : this.owner.modifyTransaction("R");
   }

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
// Useful when synchronising an external device with a property value (e.g. gpio in)
// You cannot stop the property changing or change the value, it is for information only
//
Property.prototype.propertyAboutToChange = function(_actualOutputValue, _data) {
   // BY DEFAULT, Do nothing except the value unchanged
   return _actualOutputValue;
};

//
// Defines policy for property validity
// Simple policy based of validity of defined sources and config variable this.allSourcesRequiredForValidity
// Override this to create a more complex policy
//
Property.prototype.amIValid = function() {

   if (this.ignoreInvalid) {
      return true;
   }
   else if (this.allSourcesRequiredForValidity) {

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

   if (this.valid && !oldValid) {
      this.goValid(_data);
   }
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

//
// Internal function can be called by derived properties
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
      this.invalidate();
   }
};

//
// Called by SourceListener as a defined source has changed it property value
//
Property.prototype.receivedEventFromSource = function(_data) {

   if (this.valid) {

      if (this.sourceListeners[_data.sourceEventName]) {
         this.owner.currentTransaction = _data.transaction;
         this.newEventReceivedFromSource(this.sourceListeners[_data.sourceEventName], _data);
      }
   }
};

//
// Derived Properties should override this to process property changes from defined sources
// If the property wants to update its value, it should call this.updatePropertyInternal() method
// Only then will the property value be set
//
Property.prototype.newEventReceivedFromSource = function(_sourceListener, _data) {
   this.updatePropertyInternal(_data.value, _data);
};

// Create another property to exist alongside this property
// Can be used to create a statemodel where the actions apply to this property
//
Property.prototype.createProperty = function(_config) {
   return this.owner.createProperty(_config);
};

// ====================
// INTERNAL METHODS
// ====================

// Not to be called by anything other than owner (Thing or Source)
Property.prototype._actuallySetPropertyValue = function(_newValue, _data) {

   if ((this.value !== _newValue) || this.cold) {

      if (this.cold) {
         this.cold = false;

         if (!this.initialValueSet && _data.hasOwnProperty("coldStart")) {
            delete _data.coldStart;
         }
      }

      this.previousValue = this.value;
      this.value = _newValue;
   }
};

Property.prototype.setPropertyInternal = function(_newValue, _data) {
   console.log(this.uName + ": setPropertyInternal value="+_newValue);

   if ((this.value !== _newValue) || this.cold) {

      if (this.cold) {
         _data.coldStart = true;
      }

      _data.local = this.local;
      this.checkTransaction();
      return (_newValue === this.owner.updateProperty(this.name, _newValue, _data));
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
};

Property.prototype.checkData = function(_value, _data) {

   if (!_data.hasOwnProperty('sourceName')) _data.sourceName = this.owner.uName;
   if (!_data.hasOwnProperty('name')) _data.name = this.name;
   if (!_data.hasOwnProperty('value')) _data.value = _value;
};

Property.prototype._addSource = function(_source) {
   this.hasSourceOutputValues = this.hasSourceOutputValues || (_source.hasOwnProperty('outputValues'));

   if (!_source.hasOwnProperty("uName") || _source.uName == undefined) {
      _source.uName = this.owner.uName;
   }

   var sourceListener = new SourceListener(_source, this);
   this.sourceListeners[sourceListener.sourceEventName] = sourceListener;
};

Property.prototype._cleanUp = function() {

   for (var sl in this.sourceListeners) {

      if (this.sourceListeners.hasOwnProperty(sl)) {
         this.sourceListeners[sl].stopListening();
      }
   }
};

module.exports = exports = Property;
