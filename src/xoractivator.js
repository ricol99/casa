var util = require('util');
var events = require('events');
var LogicActivator = require('./logicactivator');
var CasaSystem = require('./casasystem');

function XorActivator(_config) {

   LogicActivator.call(this, _config);

   var that = this;
}

util.inherits(XorActivator, LogicActivator);

XorActivator.prototype.checkActivate = function() {

   if (this.inputs.every(function (input) { return input.active; })) {
      return false;
   }

   return this.inputs.some(function (input) {
      return input.active;
   });
};

module.exports = exports = XorActivator;
