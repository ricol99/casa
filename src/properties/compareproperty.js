var util = require('util');
var Property = require('../property');

function CompareProperty(_config, _owner) {
   _config.allSourcesRequiredForValidity = true;
   this.comparison = _config.comparison;

   Property.call(this, _config, _owner);
}

util.inherits(CompareProperty, Property);

CompareProperty.prototype.newEventReceivedFromSource = function(_sourceListener, _data) {
   var newValue = this.calculateOutputValue();
 
   if (newValue !== this.value) {
      this.updatePropertyInternal(newValue, _data);
   }
};

CompareProperty.prototype.calculateOutputValue = function() {

   var inputs = [];
   var i = 0;

   for (var prop in this.sourceListeners) {

      if (this.sourceListeners.hasOwnProperty(prop) && this.sourceListeners[prop] && this.sourceListeners[prop].isValid()) {
         inputs[i++] = this.sourceListeners[prop].sourcePropertyValue;
      }
      else {
         return false;
      }
   }

   var output = false;
   var exp = this.comparison.replace(/\$values/g, "inputs");
   eval("output = " + exp);
   return output;
};

CompareProperty.prototype.amIValid = function() {

   var ret = Property.prototype.amIValid.call(this);

   if (ret && !this.cold) {
      var newValue = this.calculateOutputValue();
 
      if (newValue !== this.value) {
         this.updatePropertyInternal(newValue, { sourceName: this.owner.uName });
      }
   }

   return ret;
};

module.exports = exports = CompareProperty;
