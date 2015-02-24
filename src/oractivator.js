var util = require('util');
var events = require('events');
var LogicActivator = require('./logicactivator');
var CasaSystem = require('./casasystem');

function OrActivator(_name, _sources, _casa) {

  if (_name.name) {
      // constructing from object rather than params
      var casaSys = CasaSystem.mainInstance();
      var casa = casaSys.findCasa(_name.casa);
      var sources = [];

      _name.sources.forEach(function(sourceName) {
         sources.push(casaSys.findSource(sourceName));
      });

      LogicActivator.call(this, _name.name, sources, casa);
   }
   else {
      LogicActivator.call(this, _name, _sources, _casa);
   }

   var that = this;
}

util.inherits(OrActivator, LogicActivator);

OrActivator.prototype.checkActivate = function() {
   return this.inputs.some(function (_input) {
      return _input.active;
   });
};

module.exports = exports = OrActivator;
