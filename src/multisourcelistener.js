var util = require('util');
var SourceListener = require('./sourcelistener');
var CasaSystem = require('./casasystem');

function MultiSourceListener(_config, _owner) {

   this.name = _config.name;
   this.allInputsRequiredForValidity = _config.hasOwnProperty('allInputsRequiredForValidity') ? _config.allInputsRequiredForValidity : true;
   this.defaultTriggerConditions = (_config.defaultTriggerConditions == undefined) ? false : _config.defaultTriggerConditions;

   console.log(this.name + ': All inputs for validity = ' + this.allInputsRequiredForValidity);

   this.casaSys = CasaSystem.mainInstance();
   this.owner = _owner;

   this.sourceListeners = {};
   this.sourceAttributes = {};
   this.constructing = true;

   var that = this;

   for (var index = 0; index < _config.sources.length; ++index) {

      if (typeof _config.sources[index] == "string") {
         var sourcePropertyName = _config.sources[index] + '::ACTIVE';
         this.sourceListeners[sourcePropertyName] = new SourceListener({ source: _config.sources[index], defaultTriggerConditions: this.defaultTriggerConditions }, this);
         this.sourceAttributes[sourcePropertyName] = { priority: index, active: false };
      }
      else {
         // Assume object
         var sourcePropertyName = _config.sources[index].source + '::' + ((_config.sources[index].sourceProperty) ? _config.sources[index].sourceProperty : 'ACTIVE');
         _config.sources[index].defaultTriggerConditions = this.defaultTriggerConditions;
         this.sourceListeners[sourcePropertyName] = new SourceListener(_config.sources[index], this);
         this.sourceAttributes[sourcePropertyName] = { priority: index, active: false,
                                                       outputActiveValue: _config.sources[index].outputActiveValue,
                                                       outputInactiveValue: _config.sources[index].outputInactiveValue };
      }
   };

   this.constructing = false;

   this.sourceListenerEnabled = this.checkIfValid();

   if (this.sourceListenerEnabled) {
      this.owner.sourceIsValid({ sourceName: this.name });
   }
}

MultiSourceListener.prototype.copyData = function(_sourceData) {
   var newData = {};

   for (var prop in _sourceData) {

      if (_sourceData.hasOwnProperty(prop)){
         newData[prop] = _sourceData[prop];
      }
   }

   return newData;
}

MultiSourceListener.prototype.sourceIsActive = function(_data) {
   var sourcePropertyName = _data.sourceName + '::' + _data.propertyName;

   if (this.sourceListenerEnabled && this.sourceListeners[sourcePropertyName]) {
      this.sourceAttributes[sourcePropertyName].active = true;
      this.sourceAttributes[sourcePropertyName].activeData = this.copyData(_data);
      this.owner.oneSourceIsActive(this.sourceListeners[sourcePropertyName], this.sourceAttributes[sourcePropertyName], _data);
   }
}

MultiSourceListener.prototype.sourceIsInactive = function(_data) {
   var sourcePropertyName = _data.sourceName + '::' + _data.propertyName;

   if (this.sourceListenerEnabled && this.sourceListeners[sourcePropertyName]) {
      this.sourceAttributes[sourcePropertyName].active = false;
      this.sourceAttributes[sourcePropertyName].inactiveData = this.copyData(_data);
      this.owner.oneSourceIsInactive(this.sourceListeners[sourcePropertyName], this.sourceAttributes[sourcePropertyName], _data);
   }
}

MultiSourceListener.prototype.sourcePropertyChanged = function(_data) {
   var sourcePropertyName = _data.sourceName + '::' + _data.propertyName;

   if (this.sourceListenerEnabled && this.sourceListeners[sourcePropertyName]) {
      this.owner.oneSourcePropertyChanged(this.sourceListeners[sourcePropertyName], this.sourceAttributes[sourcePropertyName], _data);
   }
}

MultiSourceListener.prototype.sourceIsInvalid = function(_data) {
   var sourcePropertyName = _data.sourceName + '::' + _data.propertyName;

   var oldSourceListenerEnabled = this.sourceListenerEnabled;
   var sourceListener = this.sourceListeners[sourcePropertyName];

   if (sourceListener) {

      if (this.allInputsRequiredForValidity) {
         this.sourceListenerEnabled = false;
      }
   }

   // Has the enabled stated changed from true to false?
   if (oldSourceListenerEnabled && !this.sourceListenerEnabled) {
      // If so, tell the others guys that I am now invalid
      this.owner.sourceIsInvalid({ sourceName: this.name });
   }
};

MultiSourceListener.prototype.checkIfValid = function() {

   if (this.constructing) {
      return false;
   }

   var valid = true;

   if (this.allInputsRequiredForValidity) {

      for (var prop in this.sourceListeners) {

         if (this.sourceListeners.hasOwnProperty(prop) &&  (!this.sourceListeners[prop].sourceListenerEnabled)) {
            valid = false;
            break;
         }
      }
   }

   return valid;
}

MultiSourceListener.prototype.sourceIsValid = function(_data) {

   if (!this.sourceListenerEnabled) {

      if (this.checkIfValid()) {
         this.sourceListenerEnabled = true;
         this.owner.sourceIsValid({ sourceName: this.name });
      }
   }
}

module.exports = exports = MultiSourceListener;
