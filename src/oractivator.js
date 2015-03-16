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
   return this.inputs.some(function (_input) {
      return _input.active;
   });
};

module.exports = exports = OrActivator;
