var util = require('util');
var events = require('events');
var LogicActivator = require('./logicactivator');

function OrActivator(_config) {

   _config.allInputsRequiredForValidity = false;
   LogicActivator.call(this, _config);

   var that = this;
}

util.inherits(OrActivator, LogicActivator);

OrActivator.prototype.checkActivate = function() {
   // any input active
   for(var prop in this.multiSourceListener.sourceAttributes) {

      if (this.multiSourceListener.sourceAttributes.hasOwnProperty(prop) && this.multiSourceListener.sourceAttributes[prop] && this.multiSourceListener.sourceAttributes[prop].active) {
         return true;
      }
   }

   return false;
};

module.exports = exports = OrActivator;
