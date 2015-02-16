var util = require('util');
var events = require('events');
var LogicActivator = require('./logicactivator');

function AndActivator(_name, _sources, _timeout, _invert) {
   this.inputs = [];

   LogicActivator.call(this, 'and:' + _name, _sources, _timeout, _invert);

   var that = this;
}

util.inherits(AndActivator, LogicActivator);

AndActivator.prototype.checkActivate = function(inputs) {
   return inputs.every(function (input) {
      return input.active;
   });
};

AndActivator.prototype.checkDeactivate = function(inputs) {
   return !this.checkActivate(inputs);
};

module.exports = exports = AndActivator;
