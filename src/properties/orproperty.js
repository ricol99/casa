var util = require('util');
var Property = require('../property');

function OrProperty(_config, _owner) {
   _config.allSourcesRequiredForValidity = false;

   Property.call(this, _config, _owner);
}

util.inherits(OrProperty, Property);

// Called when system state is required
OrProperty.prototype.export = function(_exportObj) {
   Property.prototype.export.call(this, _exportObj);
};

// Called to restore system state before hot start
OrProperty.prototype.import = function(_importObj) {
   Property.prototype.import.call(this, _importObj);
};

// Called after system state has been restored
OrProperty.prototype.hotStart = function() {
   Property.prototype.hotStart.call(this);
};

// Called to start a cold system
OrProperty.prototype.coldStart = function () {
   Property.prototype.coldStart.call(this);
};

OrProperty.prototype.newEventReceivedFromSource = function(_sourceListener, _data) {
   var newValue = this.calculateOutputValue();
 
   if (newValue !== this.value) {
      this.updatePropertyInternal(newValue, _data);
   }
};

OrProperty.prototype.calculateOutputValue = function() {

   // any valid input active
   for (var prop in this.sourceListeners) {

      if (this.sourceListeners.hasOwnProperty(prop) && this.sourceListeners[prop] && this.sourceListeners[prop].isValid() && this.sourceListeners[prop].sourcePropertyValue) {
         return true;
      }
   }

   return false;
};

OrProperty.prototype.amIValid = function() {

   var ret = Property.prototype.amIValid.call(this);

   if (ret && !this.cold) {
      var newValue = this.calculateOutputValue();
 
      if (newValue !== this.value) {
         this.updatePropertyInternal(newValue, { sourceName: this.owner.uName });
      }
   }

   return ret;
};

module.exports = exports = OrProperty;
