var util = require('util');
var Source = require('./source');
var CasaSystem = require('./casasystem');

function SourceListener(_config, _owner) {
   this.casaSys = CasaSystem.mainInstance();
   this.sourceName = _config.source;
   this.casa = this.casaSys.casa;
   this.owner = _owner;

   console.log(this.name+": ======== config.triggerCondition="+_config.triggerCondition);
   console.log(this.name+": ======== config.triggerValue="+_config.triggerValue);
   console.log(this.name+": ======== config.sourceProperty="+_config.sourceProperty);

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

   this.name = "sourcelistener:" + _owner.name + ":" + _config.source + ":" + this.property;
   console.log(this.name+": ======== this.triggerCondition="+this.triggerCondition);
   console.log(this.name+": ======== this.triggerValue="+this.triggerValue);
   console.log(this.name+": ======== this.property="+this.property);

   this.sourceListenerEnabled = false;

   if (this.establishListeners()) {
      this.owner.sourceIsValid({ sourceName: this.sourceName, propertyName: this.property });
   }

   this.casa.addSourceListener(this);

   var that = this;
}

SourceListener.prototype.establishListeners = function() {
   var that = this;

   this.propertyChangedCallback = function(_data) {
      console.log(that.name+": ===================== Processing property change!");
      that.internalSourcePropertyChanged(_data);
   };

   this.invalidCallback = function(_data) {
      that.internalSourceIsInvalid(_data);
   };

   // refresh source
   this.source = this.casaSys.findSource(this.sourceName);
   this.sourceListenerEnabled = (this.source) ? true : false;
   console.log(this.name+': ============= sourceListenerEnabled='+this.sourceListenerEnabled);

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
         this.owner.sourceIsValid({ sourceName: this.sourceName, propertyName: this.property });
      }
   }
   return ret;
}

SourceListener.prototype.internalSourceIsInvalid = function(_data) {
   console.log(this.name + ': INVALID');

   if (_data.propertyName == this.property) {
      this.sourceListenerEnabled = false;

      this.source.removeListener('property-changed', this.propertyChangedCallback);
      this.source.removeListener('invalid', this.invalidCallback);

      this.owner.sourceIsInvalid({ sourceName: this.sourceName, propertyName: this.property });
   }
}


SourceListener.prototype.internalSourcePropertyChanged = function(_data) {

   console.log(this.name + ": ===========processing source property change, property=" + _data.propertyName);

   if (_data.propertyName == this.property) {
      console.log(this.name + ": processing source property change, property=" + _data.propertyName);
      console.log(this.name + ": ======= Trigger Condition " + this.triggerCondition);

      if (this.triggerCondition) {
      console.log(this.name + ": ==================== AAASSSSS");
         var a = _data.propertyValue;
         var b = this.triggerValue;
         var evalStr = "a " + this.triggerCondition + " b";

         if (eval(evalStr)) {
      console.log(this.name + ": ==================== AAATTTTT");
            this.owner.sourceIsActive(_data);
         }
         else {
      console.log(this.name + ": ==================== AAAUUUUU");
            this.owner.sourceIsInactive(_data);
         }
      }

      this.owner.sourcePropertyChanged(_data);
   }
}

module.exports = exports = SourceListener;
 
