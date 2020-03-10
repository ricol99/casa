var util = require('util');
var Property = require('../property');

function AndProperty(_config, _owner) {

   _config.allSourcesRequiredForValidity = true;
   Property.call(this, _config, _owner);
}

util.inherits(AndProperty, Property);

AndProperty.prototype.newEventReceivedFromSource = function(_sourceListener, _data) {
   var newValue = this.calculateOutputValue();
 
   if (newValue !== this.value) {
      this.updatePropertyInternal(newValue, _data);
   }
};

AndProperty.prototype.calculateOutputValue = function() {

   if (this.valid) {

      // all inputs active
      for (var prop in this.sourceListeners) {

         if (this.sourceListeners.hasOwnProperty(prop) && this.sourceListeners[prop] && !this.sourceListeners[prop].sourcePropertyValue) {
            return false;
         }
      }
      return true;
   }
   else {
      return false;
   }
};

AndProperty.prototype.amIValid = function() {

   var ret = Property.prototype.amIValid.call(this);

   if (ret && !this.cold) {
      var newValue = this.calculateOutputValue();
 
      if (newValue !== this.value) {
         this.updatePropertyInternal(newValue, { sourceName: this.owner.fullName });
      }
   }

   return ret;
};

module.exports = exports = AndProperty;
