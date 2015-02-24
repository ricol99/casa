var util = require('util');
var events = require('events');
var LogicActivator = require('./logicactivator');
var CasaSystem = require('./casasystem');

function XorActivator(_name, _sources, _casa) {

   if (_name.name) {
      // constructing from object rather than params
      var casaSys = CasaSystem.mainInstance();
      var casa = casaSys.findCasa(_name.owner);
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
