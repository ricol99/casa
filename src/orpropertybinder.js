var util = require('util');
var PropertyBinder = require('./propertybinder');

function OrPropertyBinder(_config, _owner) {

   _config.allInputsRequiredForValidity = false;
   PropertyBinder.call(this, _config, _owner);

   var that = this;
}

util.inherits(OrPropertyBinder, PropertyBinder);

OrPropertyBinder.prototype.newPropertyValueReceivedFromSource = function(_sourceListener, _data) {

   // any input active
   for (var prop in this.sourceListeners) {

      if (this.sourceListeners.hasOwnProperty(prop) && this.sourceListeners[prop] && this.sourceListeners[prop].sourcePropertyValue) {
         this.updatePropertyAfterRead(true, _data);
         return;
      }
   }

   this.updatePropertyAfterRead(false, _data);
};

module.exports = exports = OrPropertyBinder;
