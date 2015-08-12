var util = require('util');
var Source = require('./source');
var CasaSystem = require('./casasystem');

function MultiListeningSource(_config) {

   this.name = _config.name;
   this.allInputsRequiredForValidity = _config.hasOwnProperty('allInputsRequiredForValidity') ? _config.allInputsRequiredForValidity : true;
   console.log(this.name + ': All inputs for validity = ' + this.allInputsRequiredForValidity);

   this.casaSys = CasaSystem.mainInstance();

   Source.call(this, _config);

   this.inputs = [];
   this.inputNames = [];
   this.inputProperties = [];

   this.active = false;
   this.casa.addSourceListener(this);

   var that = this;

   _config.sources.forEach(function(_sourceName, _index) {

      if (typeof _sourceName == "string") {
         that.inputNames.push(_sourceName);
         that.inputProperties.push({});
      }
      else {
         // Assume object
         that.inputNames.push(_sourceName.source);

         if (_sourceName.property) {
            var trCondition;
            var trValue;

            if (_sourceName.triggerCondition == undefined) {
               trCondition = "==";
               trValue = (_sourceName.triggerValue == undefined) ? true : _sourceName.triggerValue;
            }
            else {
               trCondition = _sourceName.triggerCondition;
               trValue = _sourceName.triggerValue;
            }
            that.inputProperties.push({ property: _sourceName.property, triggerCondition: trCondition, triggerValue: trValue });
         }
         else {
            that.inputProperties.push({});
         }
      }
   });

   this.establishListeners();
}

util.inherits(MultiListeningSource, Source);

MultiListeningSource.prototype.establishListeners = function() {
   var that = this;
   this.sourceEnabled = false;

   // Define listening callbacks
   this.activeCallback = function(_data) {

      if (that.inputs[_data.sourceName] && that.inputs[_data.sourceName].source) {
         that.inputs[_data.sourceName].active = true;
         that.inputs[_data.sourceName].activeData = _data;
         that.oneSourceIsActive(_data, that.inputs[_data.sourceName]);
      }
   };

   this.inactiveCallback = function(_data) {

      if (that.inputs[_data.sourceName] && that.inputs[_data.sourceName].source) {
         that.inputs[_data.sourceName].active = false;
         that.inputs[_data.sourceName].inactiveData = _data;
         that.oneSourceIsInactive(_data, that.inputs[_data.sourceName]);
      }
   };

   this.propertyChangedCallback = function(_data) {
      
      if (that.inputs[_data.sourceName] && that.inputs[_data.sourceName].source) {

         if (that.inputs[_data.sourceName].property) {
            that.internalOneSourcePropertyChanged(_data, that.inputs[_data.sourceName]);
         }
         else {
            that.oneSourcePropertyChanged(_data, that.inputs[_data.sourceName]);
         }
      }
   };

   this.invalidCallback = function(_data) {
      var oldSourceEnabled = that.sourceEnabled;
      var input = that.inputs[_data.sourceName];

      if (input && input.source) {

         if (!input.property) {
            input.source.removeListener('active', that.activeCallback);
            input.source.removeListener('inactive', that.inactiveCallback);
         }
         else {
            input.source.removeListener('property-changed', that.propertyChangedCallback);
         }

         input.source.removeListener('invalid', that.invalidCallback);
         that.inputs[_data.sourceName] = null;

         if (that.allInputsRequiredForValidity) {
            that.sourceEnabled = false;
         }
      }

      // Has the enabled stated changed from true to false?
      if (oldSourceEnabled && !that.sourceEnabled) {
         // If so, tell the others guys that I am now invalid
         that.goInvalid({ sourceName: that.name });
      }
   };

   // Remove old inputs
   for(var prop in this.inputs) {

      if(this.inputs.hasOwnProperty(prop) && this.inputs[prop] && this.inputs[prop].source) {

         if (!this.inputs[prop].property) {
            this.inputs[prop].source.removeListener('active', this.activeCallback);
            this.inputs[prop].source.removeListener('inactive', this.inactiveCallback);
         }
         else {
            this.inputs[prop].source.removeListener('property-changed', this.propertyChangedCallback);
         }

         this.inputs[prop].source.removeListener('invalid', this.invalidCallback);
         this.inputs[prop] = null;
      }
   }


   // Attach sources again, perform the refresh
   var len = this.inputNames.length;
   var allInputsValid = true;

   for (var i = 0; i < len; ++i) {
      var source = this.casaSys.findSource(this.inputNames[i]);

      if (source) {
        if (source.sourceEnabled) {
           if (this.inputProperties[i].property) {
              that.inputs[source.name] = { source: source, active: false, property: this.inputProperties[i].property,
                                           triggerCondition: this.inputProperties[i].triggerCondition,
                                           triggerValue: this.inputProperties[i].triggerValue, priority: i };
           }
           else {
              that.inputs[source.name] = { source: source, active: false, priority: i };
           }
        }
        else {
           allInputsValid = false;
        }
      }
   }

   if (this.allInputsRequiredForValidity && !allInputsValid) {
      // Not valid so remove inputs 
      for(var prop in this.inputs) {

         if(this.inputs.hasOwnProperty(prop)){
            this.inputs[prop] = null;
         }
      }
   }
   else {
      for(var prop in this.inputs) {

         if (this.inputs.hasOwnProperty(prop) && this.inputs[prop]){

            if (!this.inputs[prop].property) {
               this.inputs[prop].source.on('active', this.activeCallback);
               this.inputs[prop].source.on('inactive', this.inactiveCallback);
            }
            else {
               this.inputs[prop].source.on('property-changed', this.propertyChangedCallback);
            }

            this.inputs[prop].source.on('invalid', this.invalidCallback);
         }
      }

      this.sourceEnabled = true;
   }

   return this.sourceEnabled;
}

MultiListeningSource.prototype.refreshSources = function() {
   var ret = true;
   if (!this.sourceEnabled || !this.allInputsRequiredForValidity) {
      ret = this.establishListeners();
      console.log(this.name + ': Refreshed action. result=' + ret);
   }
   return ret;
}

MultiListeningSource.prototype.internalOneSourcePropertyChanged = function(_data, _input) {

   if (_data.propertyName == this.property) {
      var a = _data.propertyValue;
      var b = _input.triggerValue;
      var evalStr = "a " + _input.triggerCondition + " b";

      if (eval(evalStr)) {
         that.inputs[_data.sourceName].active = true;
         that.inputs[_data.sourceName].activeData = _data;
         this.sourceIsActive(_data, _input);
      }
      else {
         that.inputs[_data.sourceName].active = false;
         that.inputs[_data.sourceName].inactiveData = _data;
         this.sourceIsInactive(_data, _input);
      }
   }
   this.sourcePropertyChanged(_data, _input);
}

MultiListeningSource.prototype.oneSourceIsActive = function(_data, _input) {
   // DO NOTHING BY DEFAULT
}

MultiListeningSource.prototype.oneSourceIsInactive = function(_data, _input) {
   // DO NOTHING BY DEFAULT
}

MultiListeningSource.prototype.oneSourcePropertyChanged = function(_data, _input) {
   // DO NOTHING BY DEFAULT
}

module.exports = exports = MultiListeningSource;
