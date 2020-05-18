var util = require('util');
var Property = require('../property');

function XorProperty(_config, _owner) {
   _config.allSourcesRequiredForValidity = false;

   Property.call(this, _config, _owner);
}

util.inherits(XorProperty, Property);

XorProperty.prototype.newEventReceivedFromSource = function(_sourceListener, _data) {
   var newValue = this.calculateOutputValue();
 
   if (newValue !== this.value) {
      this.updatePropertyInternal(newValue, _data);
   }
};

XorProperty.prototype.calculateOutputValue = function() {
   var allInputsActive = true;
   var oneInputActive = false;

   // all inputs active
   for (var prop in this.sourceListeners) {

      if (this.sourceListeners.hasOwnProperty(prop) && this.sourceListeners[prop] && this.sourceListeners[prop].isValid() && this.sourceListeners[prop].sourcePropertyValue) {
         oneInputActive = true;
      }
      else {
         allInputsActive = false;
      }
   }

   return allInputsActive ? false : oneInputActive;
};

XorProperty.prototype.amIValid = function() {

   var ret = Property.prototype.amIValid.call(this);

   if (ret && !this.cold) {
      var newValue = this.calculateOutputValue();
 
      if (newValue !== this.value) {
         this.updatePropertyInternal(newValue, { sourceName: this.owner.uName });
      }
   }

   return ret;
};

module.exports = exports = XorProperty;

