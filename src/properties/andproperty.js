var util = require('util');
var Property = require('../property');

function AndProperty(_config, _owner) {

   _config.allSourcesRequiredForValidity = true;
   Property.call(this, _config, _owner);
}

util.inherits(AndProperty, Property);

AndProperty.prototype.newEventReceivedFromSource = function(_sourceListener, _data) {

   // all inputs active
   for (var prop in this.sourceListeners) {

      if (this.sourceListeners.hasOwnProperty(prop) && this.sourceListeners[prop] && !this.sourceListeners[prop].sourcePropertyValue) {
         this.updatePropertyInternal(false, _data);
         return;
      }
   }

   this.updatePropertyInternal(true, _data);

};

module.exports = exports = AndProperty;
