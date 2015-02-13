var util = require('util');
var events = require('events');
var LogicActivator = require('./logic-activator');

function OrActivator(_name, _sources, _timeout, _invert) {
   this.inputs = [];

   LogicActivator.call(this, 'and:' + _name, _sources, _timeout, _invert);

   var that = this;
}

util.inherits(OrActivator, LogicActivator);

OrActivator.prototype.checkActivate = function(inputs) {
   return inputs.some(function (input) {
      return input.active;
   });
};

OrActivator.prototype.checkDeactivate = function(inputs) {
   return !this.checkActivate(inputs);
};

module.exports = exports = OrActivator;
