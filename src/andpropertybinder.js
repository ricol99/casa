var util = require('util');
var PropertyBinder = require('./propertybinder');

function AndPropertyBinder(_config, _owner) {

   _config.allInputsRequiredForValidity = true;
   PropertyBinder.call(this, _config, _owner);

   var that = this;
}

util.inherits(AndPropertyBinder, PropertyBinder);

AndPropertyBinder.prototype.calculateNewOutputValue = function(_sourceListener, _data, _callback) {
   // all inputs active
   for (var prop in this.sourceListeners) {

      if (this.sourceListeners.hasOwnProperty(prop) && this.sourceListeners[prop] && !this.sourceListeners[prop].sourcePropertyValue) {
         return _callback(null, false);
      }
   }

   return _callback(null, true);
};

module.exports = exports = AndPropertyBinder;
