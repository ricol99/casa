var util = require('util');
var MultiLogicPropertyBinder = require('./multilogicpropertybinder');

function AndPropertyBinder(_config, _owner) {

   _config.allInputsRequiredForValidity = true;
   MultiLogicPropertyBinder.call(this, _config, _owner);

   var that = this;
}

util.inherits(AndPropertyBinder, MultiLogicPropertyBinder);

AndPropertyBinder.prototype.checkActivate = function() {
   // all inputs active
   for (var prop in this.multiSourceListener.sourceAttributes) {

      if (this.multiSourceListener.sourceAttributes.hasOwnProperty(prop) && this.multiSourceListener.sourceAttributes[prop] && !this.multiSourceListener.sourceAttributes[prop].active) {
         return false;
      }
   }

   return true;
};

module.exports = exports = AndPropertyBinder;