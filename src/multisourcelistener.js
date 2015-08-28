var util = require('util');
var SourceListener = require('./sourcelistener');
var CasaSystem = require('./casasystem');

function MultiSourceListener(_config, _owner) {

   this.name = _config.name;
   this.allInputsRequiredForValidity = _config.hasOwnProperty('allInputsRequiredForValidity') ? _config.allInputsRequiredForValidity : true;
   console.log(this.name + ': All inputs for validity = ' + this.allInputsRequiredForValidity);

   this.casaSys = CasaSystem.mainInstance();
   this.owner = _owner;

   this.sourceListeners = {};
   this.sourceAttributes = {};
   this.constructing = true;

   var that = this;

   for (var index = 0; index < _config.sources.length; ++index) {

      if (typeof _config.sources[index] == "string") {
         this.sourceListeners[_config.sources[index]] = new SourceListener({ source: _config.sources[index] }, this);
         this.sourceAttributes[_config.sources[index]] = { priority: index, active: false };
      }
      else {
         // Assume object
         this.sourceListeners[_config.sources[index].source] = new SourceListener(_config.sources[index], this);
         this.sourceAttributes[_config.sources[index].source] = { priority: index, active: false };
      }
   };

   this.constructing = false;

   this.sourceListenerEnabled = this.checkIfValid();

   if (this.sourceListenerEnabled) {
      this.owner.sourceIsValid({ sourceName: this.name });
   }
}

MultiSourceListener.prototype.sourceIsActive = function(_data) {

   if (this.sourceListenerEnabled && this.sourceListeners[_data.sourceName]) {
      this.sourceAttributes[_data.sourceName].active = true;
      this.sourceAttributes[_data.sourceName].activeData = _data;
      this.owner.oneSourceIsActive(this.sourceListeners[_data.sourceName], this.sourceAttributes[_data.sourceName], _data);
   }
}

MultiSourceListener.prototype.sourceIsInactive = function(_data) {

   if (this.sourceListenerEnabled && this.sourceListeners[_data.sourceName]) {
      this.sourceAttributes[_data.sourceName].active = false;
      this.sourceAttributes[_data.sourceName].inactiveData = _data;
      this.owner.oneSourceIsInactive(this.sourceListeners[_data.sourceName], this.sourceAttributes[_data.sourceName], _data);
   }
}

MultiSourceListener.prototype.sourcePropertyChanged = function(_data) {

   if (this.sourceListenerEnabled && this.sourceListeners[_data.sourceName]) {
      this.owner.oneSourcePropertyChanged(this.sourceListeners[_data.sourceName], this.sourceAttributes[_data.sourceName], _data);
   }
}

MultiSourceListener.prototype.sourceIsInvalid = function(_data) {
   var oldSourceListenerEnabled = this.sourceListenerEnabled;
   var sourceListener = this.sourceListeners[_data.sourceName];

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
