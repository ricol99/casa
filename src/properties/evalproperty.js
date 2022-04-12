var util = require('util');
var Property = require('../property');

function EvalProperty(_config, _owner) {
   _config.allSourcesRequiredForValidity = true;
   this.expression = _config.expression;

   Property.call(this, _config, _owner);
}

util.inherits(EvalProperty, Property);

// Called when system state is required
EvalProperty.prototype.export = function(_exportObj) {
   Property.prototype.export.call(this, _exportObj);
};

// Called to restore system state before hot start
EvalProperty.prototype.import = function(_importObj) {
   Property.prototype.import.call(this, _importObj);
};

// Called after system state has been restored
EvalProperty.prototype.hotStart = function() {
   Property.prototype.hotStart.call(this);
};

// Called to start a cold system
EvalProperty.prototype.coldStart = function () {
   Property.prototype.coldStart.call(this);
};

EvalProperty.prototype.newEventReceivedFromSource = function(_sourceListener, _data) {
   var newValue = this.calculateOutputValue();
 
   if (newValue !== this.value) {
      this.updatePropertyInternal(newValue, _data);
   }
};

EvalProperty.prototype.calculateOutputValue = function() {

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
   var exp = this.expression.replace(/\$values/g, "inputs");
   eval("output = " + exp);
   return output;
};

EvalProperty.prototype.amIValid = function() {

   var ret = Property.prototype.amIValid.call(this);

   if (ret && !this.cold) {
      var newValue = this.calculateOutputValue();
 
      if (newValue !== this.value) {
         this.updatePropertyInternal(newValue, { sourceName: this.owner.uName });
      }
   }

   return ret;
};

module.exports = exports = EvalProperty;
