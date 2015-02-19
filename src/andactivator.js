var util = require('util');
var events = require('events');
var LogicActivator = require('./logicactivator');
var CasaSystem = require('./casasystem');

function AndActivator(_name, _sources, _timeout, _invert) {

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
