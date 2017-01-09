var util = require('util');
var SourceListener = require('./sourcelistener');

function PropertyBinder(_config, _owner) {
   this.name = _config.name;
   this.propertyName = _config.propertyName;
   this.ownerName = _owner.name;
   this.writeable = (_config.writeable) ? _config.writeable : true;
   this.owner = _owner;
   this.allSourcesRequiredForValidity = (_config.allSourcesRequiredForValidity) ? _config.allSourcesRequiredForValidity : false;
   this.captiveProperty = (_config.captiveProperty) ? _config.captiveProperty : true;
   this.prioritiseSources = _config.prioritiseSources;
  
   this.outputTransform = _config.outputTransform; 
   this.outputMap = (_config.outputMap) ? copyData(_config.outputMap) : undefined;

   this.binderEnabled = false;
   this.manualMode = false;
   this.cold = true;

   var that = this;

   this.sourceListeners = {};
   this.noOfSources = 0;

   if (_config.sources) {

      if (this.captiveProperty) {
         // Don't allow the main property to be set from outside as we have mulitple sources we
         // are listening to and the property is captivated by these sources
         this.writeable = false;
      }

      this.binderEnabled = false;
      this.constructing = true;

      for (var index = 0; index < _config.sources.length; ++index) {

         if (_config.sources[index].priority == undefined) {
            _config.sources[index].priority = index;
         }

         var sourceListener = new SourceListener(_config.sources[index], this);
         this.sourceListeners[sourceListener.sourcePropertyName] = sourceListener;
         this.noOfSources++;
      };

      this.constructing = false;
   }
   else if (_config.source) {

      if (this.captiveProperty) {
         // Don't allow the main property to be set from outside as we have a source we
         // are listening to and the property is captivated by that source
         this.writeable = false;
      }

      this.binderEnabled = false;
      this.constructing = true;

      var sourceListener = new SourceListener(_config, this);
      this.sourceListeners[sourceListener.sourcePropertyName] = sourceListener;
      this.noOfSources++;

      this.constructing = false;
   }
   else {
      this.binderEnabled = true;
      this.mulitSourceListener = null;
      this.sourceListener = null;
   }

   if (_config.target) {
      this.targetProperty = (_config.targetProperty) ? _config.targetProperty : "ACTIVE";
      this.ignoreTargetUpdates = (_config.ignoreTargetUpdates == undefined) ? true : _config.ignoreTargetUpdates;
      this.targetListener = new SourceListener({ source: _config.target, sourceProperty: this.targetProperty, isTarget: true,
                                                 ignoreSourceUpdates: this.ignoreTargetUpdates, inputTransform: _config.targetInputTransform,
                                                 inputMap:_config.targetInputMap}, this);

      this.target = this.targetListener.source;
   }

   if (_config.listenController) {
      this.listenControllerProperty = (_config.listenControllerProperty) ? _config.listenControllerProperty : "ACTIVE";
      this.listenControllerListener = new SourceListener({ source: _config.listenController, sourceProperty: this.listenControllerProperty, isTarget: true,
                                                         ignoreSourceUpdates: false, inputTransform: _config.listenControllerInputTransform,
                                                         inputMap:_config.listenControllerInputMap}, this);

      this.listenController = this.listenControllerListener.source;
   }

   this.listening = true;
}

// INTERNAL METHODS
PropertyBinder.prototype.myPropertyValue = function() {
   return this.owner.props[this.propertyName];
}

function findHighestPrioritySource(_this, _sourcePropertyValue) {
   var highestPriorityFound = 99999;
   var highestPrioritySource = null;

   for (var sourcePropertyName in _this.sourceListeners) {

      if (_this.sourceListeners.hasOwnProperty(sourcePropertyName)){
         var sourceListener = _this.sourceListeners[sourcePropertyName];

         if (sourceListener && sourceListener.sourceListenerEnabled && (sourceListener.priority < highestPriorityFound) && (sourceListener.sourcePropertyValue == _sourcePropertyValue)) {
            highestPriorityFound = sourceListener.priority;
            highestPrioritySource = sourceListener;
         }
      }
   }

   return highestPrioritySource;
}

function transformNewPropertyValue(_this, _newPropValue, _data) {
   var actualOutputValue = _newPropValue;
   var sourceListener = (_data.sourcePropertyName != undefined) ? _this.sourceListeners[_data.sourcePropertyName] : undefined;

   if (sourceListener) {
      var sourceListenerInCharge = sourceListener;

      if (_this.prioritiseSources) {
         var highestPrioritySource = findHighestPrioritySource(_this, _newPropValue);

         if (highestPrioritySource && (highestPrioritySource.priority >= sourceListener.priority)) {
            sourceListenerInCharge = highestPrioritySource;
         }
         if (highestPrioritySource) {
            console.log(this.name+": AAAAAAAAAAAAAAA High="+highestPrioritySource.name+", sourceListener="+sourceListener.name);
         }
      }

      if (sourceListenerInCharge.outputValues && sourceListenerInCharge.outputValues[actualOutputValue] != undefined) {
         actualOutputValue = sourceListenerInCharge.outputValues[actualOutputValue];
      }
   }

   if (_this.outputTransform || _this.outputMap) {
      var output = actualOutputValue;
      var newOutput = output;

      if (_this.outputTransform) {
         var exp = _this.outputTransform.replace(/\$value/g, "output");
         newOutput = eval(exp);
      }

      if (_this.outputMap && _this.outputMap[newOutput] != undefined) {
         newOutput = _this.outputMap[newOutput];
      }

      actualOutputValue = newOutput;
   }

   return actualOutputValue;
}

PropertyBinder.prototype.updatePropertyAfterRead = function(_newPropValue, _data) {
   var actualOutputValue = transformNewPropertyValue(this, _newPropValue, _data);

   if (this.myPropertyValue() != actualOutputValue || this.cold) {
      this.cold = false;
      this.owner.updateProperty(this.propertyName, actualOutputValue, _data);
   }
}

PropertyBinder.prototype.goInvalid = function(_data) {
   this.owner.goInvalid(this.propertyName, _data);
}

// Override this to actually update what ever the property is bound to
PropertyBinder.prototype.setProperty = function(_propValue, _data, _callback) {

   if (this.manualMode) {
      
      if (this.myPropertyValue() != _propValue) {
         this.updatePropertyAfterRead(_propName, _propValue, _data);
         _callback(true);         
      }
      else {
         _callback(true);                  
      }
   }
   else {
      _callback(false);
   }
}

PropertyBinder.prototype.setManualMode = function(_manualMode) {
   this.manualMode = _manualMode;

   if (_manualMode) {
      this.listening = false;
   }
   else {
      if (this.listenController &&  listenControllerListener.getProperty() != undefined) {
         this.listening = listenControllerListener.getProperty();
      }
      else {
         this.listening = true;
      }
   }
}


PropertyBinder.prototype.sourceIsValid = function(_data) {

   var oldBinderEnabled = this.binderEnabled;
   this.binderEnabled = isBinderValid(this);

   this.target = (this.targetListener) ? this.targetListener.source : null;

   this.listenController = (this.listenControllerListener) ? this.listenControllerListener.source : null;

   if (this.listenController &&  listenControllerListener.getProperty() != undefined) {
      this.listening = listenControllerListener.getProperty();
   }
   else {
      this.listening = true;
   }

   if (!oldBinderEnabled && this.binderEnabled) {
      this.sourcePropertyChanged(_data);
   }
}

PropertyBinder.prototype.sourceIsInvalid = function(_data) {

   var oldBinderEnabled = this.binderEnabled;
   this.binderEnabled = isBinderValid(this);

   // Has the enabled stated changed from true to false?
   if (oldBinderEnabled && !this.binderEnabled) {
      // If so, tell the others guys that I am now invalid
      console.log(this.name + ': INVALID');

      this.target = null;
      this.listenController = null;
      this.goInvalid(_data);
   }
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

function isBinderValid(_this) {

   if (_this.allSourcesRequiredForValidity) {

      return (allAssocArrayElementsDo(_this.sourceListeners, function(_sourceListener) {
            return _sourceListener.sourceListenerEnabled;
      }));
   }
   else {
      return (anyAssocArrayElementsDo(_this.sourceListeners, function(_sourceListener) {
            return _sourceListener.sourceListenerEnabled;
      }));
   }
}

PropertyBinder.prototype.sourcePropertyChanged = function(_data) {
   var that = this;

   if (this.binderEnabled && this.listening && this.sourceListeners[_data.sourcePropertyName]) {
      this.newPropertyValueReceivedFromSource(this.sourceListeners[_data.sourcePropertyName], _data);
   }
}

PropertyBinder.prototype.targetPropertyChanged = function(_data) {

   if (this.binderEnabled) {
      if (this.targetListener.sourcePropertyName == _data.sourcePropertyName) {
         this.newPropertyValueReceivedFromTarget(this.targetListener, _data);
      }
      else if (this.listenControllerListener.sourcePropertyName == _data.sourcePropertyName && !this.manualMode) {
         this.processListenControllerPropertyChange(this.listenControllerListener, _data);
      }
   }
}

PropertyBinder.prototype.newPropertyValueReceivedFromSource = function(_sourceListener, _data) {
   this.updatePropertyAfterRead(_data.propertyValue, _data);
}

PropertyBinder.prototype.newPropertyValueReceivedFromTarget = function(_targetListener, _data) {
   // DO NOTHING BY DEFAULT
}

PropertyBinder.prototype.processListenControllerPropertyChange = function(_listenControllerListener, _data) {
   this.listening = _data.sourcePropertyValue;
}

// Override this if you listen to a source that is not "Source".
// If you listen to a "Source" you will be fired by that Source cold starting
PropertyBinder.prototype.coldStart = function(_data) {
   // DO NOTHING BY DEFAULT
}

module.exports = exports = PropertyBinder;
