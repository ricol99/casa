var util = require('util');
var Source = require('./source');
var CasaSystem = require('./casasystem');

function SourceListener(_config, _owner) {
   this.casaSys = CasaSystem.mainInstance();
   this.sourceName = _config.source;
   this.name = "sourcelistener:" + _owner.name + ":" + _config.source;
   this.casa = this.casaSys.casa;
   this.owner = _owner;

   if (_config.sourceProperty) {
      this.property = _config.sourceProperty;

      if (_config.triggerCondition) {
         this.triggerCondition = _config.triggerCondition;
         this.triggerValue = _config.triggerValue;
      }
      else {
         this.triggerCondition = null;
         this.triggerValue = null;
      }
   }
   else {
      this.property = "ACTIVE";
      this.triggerCondition = "==";
      this.triggerValue = true;
   }

   this.sourceListenerEnabled = false;

   if (this.establishListeners()) {
      this.owner.sourceIsValid({ sourceName: this.sourceName });
   }

   this.casa.addSourceListener(this);

   var that = this;
}

SourceListener.prototype.establishListeners = function() {
   var that = this;

   this.propertyChangedCallback = function(_data) {
      that.internalSourcePropertyChanged(_data);
   };

   this.invalidCallback = function(_data) {
      that.internalSourceIsInvalid(_data);
   };

   // refresh source
   this.source = this.casaSys.findSource(this.sourceName);
   this.sourceListenerEnabled = (this.source != null && this.source.sourceEnabled);

   if (this.sourceListenerEnabled) {
      this.source.on('property-changed', this.propertyChangedCallback);
      this.source.on('invalid', this.invalidCallback);
   }

   return this.sourceListenerEnabled;
}

SourceListener.prototype.refreshSources = function() {
   var ret = true;

   if (!this.sourceListenerEnabled)  {
      ret = this.establishListeners();
      console.log(this.name + ': Refreshed source listener. result=' + ret);

      if (ret) {
         this.owner.sourceIsValid({ sourceName: this.sourceName });
      }
   }
   return ret;
}

SourceListener.prototype.internalSourceIsInvalid = function() {
   console.log(this.name + ': INVALID');

   this.sourceListenerEnabled = false;

   this.source.removeListener('property-changed', this.propertyChangedCallback);
   this.source.removeListener('invalid', this.invalidCallback);

   this.owner.sourceIsInvalid({ sourceName: this.sourceName });
}


SourceListener.prototype.internalSourcePropertyChanged = function(_data) {

   if (_data.propertyName == this.property) {
      console.log(this.name + ": processing source property change, property=" + _data.propertyName);

      if (this.triggerCondition) {
         console.log("================AAAAA");
         var a = _data.propertyValue;
         var b = this.triggerValue;
         var evalStr = "a " + this.triggerCondition + " b";

         if (eval(evalStr)) {
         console.log("================BBBBB");
            this.owner.sourceIsActive(_data);
         }
         else {
         console.log("================CCCCC");
            this.owner.sourceIsInactive(_data);
         }

         this.owner.sourcePropertyChanged(_data);
      }
   }
}

module.exports = exports = SourceListener;
 
