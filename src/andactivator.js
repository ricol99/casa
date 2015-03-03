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
   return this.inputs.every(function (_input) {
      return _input.active;
   });
};

module.exports = exports = AndActivator;
