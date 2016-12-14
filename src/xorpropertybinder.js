var util = require('util');
var PropertyBinder = require('./propertybinder');

function XorPropertyBinder(_config, _owner) {

   _config.allInputsRequiredForValidity = false;
   PropertyBinder.call(this, _config, _owner);

   var that = this;
}

util.inherits(XorPropertyBinder, PropertyBinder);

XorPropertyBinder.prototype.calculateNewOutputValue = function(_sourceListener, _data, _callback) {
   var allInputsActive = true;
   var oneInputActive = false;

   // all inputs active
   for (var prop in this.sourceListeners) {

      if (this.sourceListeners.hasOwnProperty(prop) && this.sourceListeners[prop] && this.sourceListeners.[prop].sourcePropertyValue) {
         return _callback(null, false);
         oneInputActive = true;
      }
      else {
         allInputsActive = false;
      }
   }

   return (allInputsActive) ? _callback(null, false) : _callback(null, oneInputActive);
};

module.exports = exports = XorPropertyBinder;
