var util = require('util');
var events = require('events');
var LogicActivator = require('./logicactivator');
var CasaSystem = require('./casasystem');

function AndActivator(_config) {

   LogicActivator.call(this, _config);

   var that = this;
}

util.inherits(AndActivator, LogicActivator);

AndActivator.prototype.checkActivate = function() {
   // all inputs active
   for(var prop in this.inputs) {

      if(this.inputs.hasOwnProperty(prop) && this.inputs[prop] && !this.inputs[prop].active) {
         return false;
      }
   }

   return true;
};

module.exports = exports = AndActivator;
