var util = require('util');
var PropertyBinder = require('./propertybinder');

function OrPropertyBinder(_config, _owner) {

   _config.allInputsRequiredForValidity = false;
   PropertyBinder.call(this, _config, _owner);

   var that = this;
}

util.inherits(OrPropertyBinder, PropertyBinder);

OrPropertyBinder.prototype.calculateNewOutputValue = function(_sourceListener, _data, _callback) {
   // any input active
   for (var prop in this.sourceListeners) {

      if (this.sourceListeners.hasOwnProperty(prop) && this.sourceListeners[prop] && this.sourceListeners[prop].sourcePropertyValue) {
         return _callback(null, true);
      }
   }

   return _callback(null, false);
};

module.exports = exports = OrPropertyBinder;
