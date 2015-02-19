var util = require('util');
var events = require('events');
var LogicActivator = require('./logicactivator');
var CasaSystem = require('./casasystem');

function OrActivator(_name, _sources, _timeout, _invert) {

  if (_name.name) {
      // constructing from object rather than params
      var casaSys = CasaSystem.mainInstance();
      var sources = [];

      _name.sources.forEach(function(sourceName) {
         sources.push(casaSys.findSource(sourceName));
      });

      LogicActivator.call(this, _name.name, sources, _name.timeout, _name.invert);
   }
   else {
      LogicActivator.call(this, _name, _sources, _timeout, _invert);
   }

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
