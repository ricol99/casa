var util = require('util');
var Property = require('../property');

function OrProperty(_config, _owner) {
   _config.allSourcesRequiredForValidity = false;

   Property.call(this, _config, _owner);
}

util.inherits(OrProperty, Property);

OrProperty.prototype.newEventReceivedFromSource = function(_sourceListener, _data) {
   this.updatePropertyInternal(this.calculateOutputValue(), _data);
};

OrProperty.prototype.calculateOutputValue = function() {

   // any valid input active
   for (var prop in this.sourceListeners) {

      if (this.sourceListeners.hasOwnProperty(prop) && this.sourceListeners[prop] && this.sourceListeners[prop].valid && this.sourceListeners[prop].sourcePropertyValue) {
         return true;
      }
   }

   return false;
};

OrProperty.prototype.amIValid = function() {

   var ret = Property.prototype.amIValid.call(this);

   if (ret && !this.cold) {
      this.updatePropertyInternal(this.calculateOutputValue(), { sourceName: this.owner.uName });
   }

   return ret;
};

module.exports = exports = OrProperty;
