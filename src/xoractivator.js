var util = require('util');
var events = require('events');
var LogicActivator = require('./logicactivator');

function XorActivator(_name, _sources, _timeout, _invert) {
   this.inputs = [];

   LogicActivator.call(this, 'and:' + _name, _sources, _timeout, _invert);

   var that = this;
}

util.inherits(XorActivator, LogicActivator);

XorActivator.prototype.checkActivate = function(inputs) {
   if (inputs.every(function (input) { return input.active; })) {
      return false;
   }

   return inputs.some(function (input) {
      return input.active;
   });
};

XorActivator.prototype.checkDeactivate = function(inputs) {
   return !this.checkActivate(inputs);
};

module.exports = exports = XorActivator;
