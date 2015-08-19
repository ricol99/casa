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

      if (_config.triggerCondition == undefined) {
         this.triggerCondition = "==";
         this.triggerValue = (_config.triggerValue == undefined) ? true : _config.triggerValue;
      }
      else {
         this.triggerCondition = _config.triggerCondition;
         this.triggerValue = _config.triggerValue;
      }
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

   // Listener callbacks
   this.activeCallback = function(_data) {
      console.log("===========================BBBBBB " +this.name + ": Active Callback from " + _data.sourceName);
      that.owner.sourceIsActive(_data);
   };

   this.inactiveCallback = function(_data) {
      console.log("===========================CCCCCC " +this.name + ": Inactive Callback from " + _data.sourceName);
      that.owner.sourceIsInactive(_data);
   };

   this.propertyChangedCallback = function(_data) {
      console.log("===========================DDDDDD " +this.name + ": Property Changed Callback from " + _data.sourceName);

      if (that.property) {
      console.log("===========================EEEEEE ");
         that.internalSourcePropertyChanged(_data);
      }
      else {
      console.log("===========================FFFFFF ");
         that.owner.sourcePropertyChanged(_data);
      }
   };

   this.invalidCallback = function(_data) {
      that.internalSourceIsInvalid(_data);
   };

   // refresh source
   this.source = this.casaSys.findSource(this.sourceName);
   this.sourceListenerEnabled = (this.source != null && this.source.sourceEnabled);

   if (this.sourceListenerEnabled) {

      if (!this.property) {
         this.source.on('active', this.activeCallback);
         this.source.on('inactive', this.inactiveCallback);
      }
      this.source.on('property-changed', this.propertyChangedCallback);
      this.source.on('invalid', this.invalidCallback);
   }
   else {
      console.log(this.name + ": Source listener is not currrently valid so not registering to listen to source=" + this.sourceName);
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

   if (!this.property) {
      this.source.removeListener('active', this.activeCallback);
      this.source.removeListener('inactive', this.inactiveCallback);
   }
   this.source.removeListener('property-changed', this.propertyChangedCallback);
   this.source.removeListener('invalid', this.invalidCallback);

   this.owner.sourceIsInvalid({ sourceName: this.sourceName });
}


SourceListener.prototype.internalSourcePropertyChanged = function(_data) {
   console.log(this.name + ": processing source property change, property=" + _data.propertyName);

   if (_data.propertyName == this.property) {
      console.log("===========================AAAAAA");
      var a = _data.propertyValue;
      var b = this.triggerValue;
      var evalStr = "a " + this.triggerCondition + " b";

      if (eval(evalStr)) {
         this.owner.sourceIsActive(_data);
      }
      else {
         this.owner.sourceIsInactive(_data);
      }

      this.owner.sourcePropertyChanged(_data);
   }
}

module.exports = exports = SourceListener;
 
