var util = require('util');
var State = require('./state');
var CasaSystem = require('./casasystem');

function PropertyState(_config) {
   this.casaSys = CasaSystem.mainInstance();
   this.sourceName = _config.source;
   this.casa = this.casaSys.casa;
   this.property = _config.property;

   if (_config.triggerCondition == undefined) {
      this.triggerCondition = "==";
      this.triggerValue = (_config.triggerValue == undefined) ? true : _config.triggerValue;
   }
   else {
      this.triggerCondition = _config.triggerCondition;
      this.triggerValue = _config.triggerValue;
   }

   State.call(this, _config);

   this.establishListeners();

   var that = this;
}

util.inherits(PropertyState, State);

PropertyState.prototype.establishListeners = function() {
   var that = this;

   // Listener callbacks
   var propertyChangedCallback = function(_data) {
      that.sourcePropertyChanged(_data);
   };

   var invalidCallback = function(_data) {
      console.log(that.name + ': INVALID');

      that.sourceEnabled = false;
      that.source.removeListener('property-changed', propertyChangedCallback);
      that.source.removeListener('invalid', invalidCallback);

      that.emit('invalid', { sourceName: that.name });
   };

   // refresh source
   this.source = this.casaSys.findSource(this.sourceName);
   this.sourceEnabled = (this.source != null && this.source.sourceEnabled);

   if (this.sourceEnabled) {
      this.source.on('property-changed', propertyChangedCallback);
      this.source.on('invalid', invalidCallback);
      this.props[this.property] = this.source.getProperty(this.property);
   }

   return this.sourceEnabled;
}

PropertyState.prototype.refreshSources = function() {
   var ret = true;

   if (!this.sourceEnabled)  {
      ret = this.establishListeners();
      console.log(this.name + ': Refreshed action. result=' + ret);
   }
   return ret;
}

PropertyState.prototype.sourcePropertyChanged = function(_data) {

   if (_data.propertyName == this.property) {
      this.props[this.property] = _data.propertyValue;
      var a = _data.propertyValue;
      var b = this.triggerValue;
      var evalStr = "a " + this.triggerCondition + " b";

      if (this.active) {

         if (!eval(evalStr)) {
            this.goInactive({ sourceName: this.name });
         }
      }
      else { // inactive

         if (eval(evalStr)) {
            this.goActive({ sourceName: this.name });
         }
      }
   }
}

module.exports = exports = PropertyState;
 
