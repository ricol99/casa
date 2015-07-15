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
   for(var prop in this.inputs) {

      if(this.inputs.hasOwnProperty(prop) && this.inputs[prop] && this.inputs[prop].active) {
         return true;
      }
   }

   return false;
};

module.exports = exports = OrActivator;
