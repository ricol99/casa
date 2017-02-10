var util = require('util');
var Property = require('./property');

function OrProperty(_config, _owner) {

   _config.allSourcesRequiredForValidity = false;
   Property.call(this, _config, _owner);

   var that = this;
}

util.inherits(OrProperty, Property);

OrProperty.prototype.newPropertyValueReceivedFromSource = function(_sourceListener, _data) {

   // any input active
   for (var prop in this.sourceListeners) {

      if (this.sourceListeners.hasOwnProperty(prop) && this.sourceListeners[prop] && this.sourceListeners[prop].sourcePropertyValue) {
         this.updatePropertyInternal(true, _data);
         return;
      }
   }

   this.updatePropertyInternal(false, _data);
};

module.exports = exports = OrProperty;
