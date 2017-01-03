var util = require('util');
var PropertyBinder = require('./propertybinder');

function AndPropertyBinder(_config, _owner) {

   _config.allInputsRequiredForValidity = true;
   PropertyBinder.call(this, _config, _owner);

   var that = this;
}

util.inherits(AndPropertyBinder, PropertyBinder);

AndPropertyBinder.prototype.newPropertyValueReceivedFromSource = function(_sourceListener, _data) {
   // all inputs active
   for (var prop in this.sourceListeners) {

      if (this.sourceListeners.hasOwnProperty(prop) && this.sourceListeners[prop] && !this.sourceListeners[prop].sourcePropertyValue) {
         this.updatePropertyAfterRead(false, _data);
         return;
      }
   }

   this.updatePropertyAfterRead(true, _data);

};

module.exports = exports = AndPropertyBinder;
