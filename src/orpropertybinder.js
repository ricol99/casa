var util = require('util');
var MultiLogicPropertyBinder = require('./multilogicpropertybinder');

function OrPropertyBinder(_config, _owner) {

   _config.allInputsRequiredForValidity = false;
   MultiLogicPropertyBinder.call(this, _config, _owner);

   var that = this;
}

util.inherits(OrPropertyBinder, MultiLogicPropertyBinder);

OrPropertyBinder.prototype.checkActivate = function() {
   // any input active
   for (var prop in this.multiSourceListener.sourceAttributes) {

      if (this.multiSourceListener.sourceAttributes.hasOwnProperty(prop) && this.multiSourceListener.sourceAttributes[prop] && this.multiSourceListener.sourceAttributes[prop].active) {
         return true;
      }
   }

   return false;
};

module.exports = exports = OrPropertyBinder;
