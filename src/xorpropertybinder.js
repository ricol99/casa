var util = require('util');
var PropertyBinder = require('./propertybinder');

function XorPropertyBinder(_config, _owner) {

   _config.allInputsRequiredForValidity = false;
   PropertyBinder.call(this, _config, _owner);

   var that = this;
}

util.inherits(XorPropertyBinder, PropertyBinder);

XorPropertyBinder.prototype.newPropertyValueReceivedFromSource = function(_sourceListener, _data) {
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

   this.updatePropertyAfterRead((allInputsActive) ? false : oneInputActive, _data);
};

module.exports = exports = XorPropertyBinder;
