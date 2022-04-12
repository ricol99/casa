var util = require('util');
var Property = require('../property');

function XorProperty(_config, _owner) {
   _config.allSourcesRequiredForValidity = false;

   Property.call(this, _config, _owner);
}

util.inherits(XorProperty, Property);

// Called when system state is required
XorProperty.prototype.export = function(_exportObj) {
   Property.prototype.export.call(this, _exportObj);
};

// Called to restore system state before hot start
XorProperty.prototype.import = function(_importObj) {
   Property.prototype.import.call(this, _importObj);
};

// Called after system state has been restored
XorProperty.prototype.hotStart = function() {
   Property.prototype.hotStart.call(this);
};

// Called to start a cold system
XorProperty.prototype.coldStart = function () {
   Property.prototype.coldStart.call(this);
};

XorProperty.prototype.newEventReceivedFromSource = function(_sourceListener, _data) {
   var newValue = this.calculateOutputValue();
 
   if (newValue !== this.value) {
      this.updatePropertyInternal(newValue, _data);
   }
};

XorProperty.prototype.calculateOutputValue = function() {
   var allInputsActive = true;
   var oneInputActive = false;

   // all inputs active
   for (var prop in this.sourceListeners) {

      if (this.sourceListeners.hasOwnProperty(prop) && this.sourceListeners[prop] && this.sourceListeners[prop].isValid() && this.sourceListeners[prop].sourcePropertyValue) {
         oneInputActive = true;
      }
      else {
         allInputsActive = false;
      }
   }

   return allInputsActive ? false : oneInputActive;
};

XorProperty.prototype.amIValid = function() {

   var ret = Property.prototype.amIValid.call(this);

   if (ret && !this.cold) {
      var newValue = this.calculateOutputValue();
 
      if (newValue !== this.value) {
         this.updatePropertyInternal(newValue, { sourceName: this.owner.uName });
      }
   }

   return ret;
};

module.exports = exports = XorProperty;

