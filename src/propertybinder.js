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
  
   this.outputTransform = _config.outputTransform; 
   this.outputMap = (_config.outputMap) ? copyData(_config.outputMap) : undefined;

   this.binderEnabled = false;
   this.manualMode = false;

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
      var sourceListener = new SourceListener(_config, this);
      this.sourceListeners[sourceListener.sourcePropertyName] = sourceListener;
      this.noOfSources++;
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

PropertyBinder.prototype.updatePropertyAfterRead = function(_propValue, _data) {
   this.owner.updateProperty(this.propertyName, _propValue, _data);
}

PropertyBinder.prototype.goInvalid = function(_data) {
   this.owner.goInvalid(this.propertyName, _data);
}

// Override this to actually update what ever the property is bound to
PropertyBinder.prototype.setProperty = function(_propValue, _data, _callback) {
   _callback(false);
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

PropertyBinder.prototype.sourceIsValid = function() {

   if (allAssocArrayElementsDo(this.sourceListeners, function(_sourceListener) {
         return _sourceListener.sourceListenerEnabled;
   })) {
      this.binderEnabled = true;
   }

   this.target = (this.targetListener) ? this.targetListener.source : null;
   this.listenController = (this.listenControllerListener) ? this.listenControllerListener.source : null;

   if (this.listenController &&  listenControllerListener.getProperty() != undefined) {
      this.listening = listenControllerListener.getProperty();
   }
   else {
      this.listening = true;
   }
}

PropertyBinder.prototype.sourceIsInvalid = function(_data) {
   console.log(this.name + ': INVALID');

   this.binderEnabled = false;
   this.target = null;
   this.listenController = null;
   this.goInvalid(_data);
}

function transformOutput(_instance, _currentOutputValue) {
   var output = _currentOutputValue;
   var newOutput = output;

   if (_instance.outputTransform) {
      var exp = _instance.outputTransform.replace("$value", "output");
      newOutput = eval(exp);
   }

   if (_instance.outputMap && _instance.outputMap[newInput] != undefined) {
      newOutput = _instance.outputMap[newOutput];
   }

   return newOutput;
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

PropertyBinder.prototype.sourcePropertyChanged = function(_data) {
   var that = this;

   if (this.binderEnabled && this.listening && this.sourceListeners[_data.sourcePropertyName]) {

      this.calculateNewOutputValue(this.sourceListeners[_data.sourcePropertyName], _data, function(_err, _newOutputValue) {
         if (!_err) {
            that.internalProcessSourcePropertyChange(that.sourceListeners[_data.sourcePropertyName], that.sourceListeners[_data.sourcePropertyName].lastData, _newOutputValue);
         }
      });
   }
}

PropertyBinder.prototype.targetPropertyChanged = function(_data) {

   if (this.binderEnabled) {
      if (this.targetListener.sourcePropertyName == _data.sourcePropertyName) {
         this.processTargetPropertyChange(this.targetListener, _data);
      }
      else if (this.listenControllerListener.sourcePropertyName == _data.sourcePropertyName && !this.manualMode) {
         this.processListenControllerPropertyChange(this.listenControllerListener, _data);
      }
   }
}

PropertyBinder.prototype.internalProcessSourcePropertyChange = function(_sourceListener, _data, _newOutputValue) {
   var highestPrioritySource = this.findHighestPrioritySource(_newOutputValue);

   if (!highestPrioritySource || (highestPrioritySource.priority < _sourceListener.priority)) {
      highestPrioritySource = _sourceListener;
   }

   var actualOutputValue = (highestPrioritySource.outputValues[_newOutputValue] == undefined) ? _newOutputValue : highestPrioritySource.outputValues[_newOutputValue];

   if (this.outputTransform || this.outputMap) {
      actualOutputValue = transformOutput(this, actualOutputValue);
   }

   if ((this.myPropertyValue() != actualOutputValue) || (highestPrioritySource.priority > _sourceListener.priority)) {
      this.updatePropertyAfterRead(actualOutputValue, highestPrioritySource.lastData);
   }
}

PropertyBinder.prototype.findHighestPrioritySource = function(_sourcePropertyValue) {
   var highestPriorityFound = 99999;
   var highestPrioritySource = null;

   for (var prop in this.sourceListeners) {

      if(this.sourceListeners.hasOwnProperty(prop)){
         var sourceListener = this.sourceListeners[prop];

         if (sourceListener && (sourceListener.priority < highestPriorityFound) && (sourceListener.sourcePropertyValue == _sourcePropertyValue)) {
            highestPriorityFound = sourceListener.priority;
            highestPrioritySource = sourceListener;
         }
      }
   }

   return highestPrioritySource;
}

PropertyBinder.prototype.calculateNewOutputValue = function(_sourceListener, _data, _callback) {
   return _callback(null, _data.propertyValue);
}

PropertyBinder.prototype.processTargetPropertyChange = function(_targetListener, _data) {
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
