var util = require('util');
var Property = require('../property');

function OrProperty(_config, _owner) {
   _config.allSourcesRequiredForValidity = false;

   Property.call(this, _config, _owner);
}

util.inherits(OrProperty, Property);

OrProperty.prototype.newEventReceivedFromSource = function(_sourceListener, _data) {
   console.log(this.uName+": AAAAAAAAA currentValue="+this.value+", newValue="+this.calculateOutputValue());
   this.updatePropertyInternal(this.calculateOutputValue(), _data);
};

OrProperty.prototype.calculateOutputValue = function() {

   // any valid input active
   for (var prop in this.sourceListeners) {

      if (this.sourceListeners.hasOwnProperty(prop) && this.sourceListeners[prop] && this.sourceListeners[prop].isValid() && this.sourceListeners[prop].sourcePropertyValue) {
         return true;
      }
   }

   return false;
};

OrProperty.prototype.amIValid = function() {

   var ret = Property.prototype.amIValid.call(this);

   if (ret && !this.cold) {
      var newValue = this.calculateOutputValue();
   console.log(this.uName+": AAAAAAAAA amIValid() currentValue="+this.value+", newValue="+newValue);
 
      if (newValue !== this.value) {
         this.updatePropertyInternal(newValue, { sourceName: this.owner.uName });
      }
   }

   return ret;
};

module.exports = exports = OrProperty;
