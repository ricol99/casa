var util = require('util');
var Property = require('../property');

function XorProperty(_config, _owner) {

   _config.allSourcesRequiredForValidity = false;
   Property.call(this, _config, _owner);

   var that = this;
}

util.inherits(XorProperty, Property);

XorProperty.prototype.newPropertyValueReceivedFromSource = function(_sourceListener, _data) {
   var allInputsActive = true;
   var oneInputActive = false;

   // all inputs active
   for (var prop in this.sourceListeners) {

      if (this.sourceListeners.hasOwnProperty(prop) && this.sourceListeners[prop] && this.sourceListeners.[prop].sourcePropertyValue) {
         return false;
         oneInputActive = true;
      }
      else {
         allInputsActive = false;
      }
   }

   this.updatePropertyInternal((allInputsActive) ? false : oneInputActive, _data);
};

module.exports = exports = XorProperty;
