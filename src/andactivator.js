var util = require('util');
var events = require('events');
var LogicActivator = require('./logicactivator');
var CasaSystem = require('./casasystem');

function AndActivator(_name, _sources) {

   if (_name.name) {
      // constructing from object rather than params
      var casaSys = CasaSystem.mainInstance();
      var sources = [];

      _name.sources.forEach(function(sourceName) {
         sources.push(casaSys.findSource(sourceName));
      });

      LogicActivator.call(this, _name.name, sources);
   }
   else {
      LogicActivator.call(this, _name, _sources);
   }


   var that = this;
}

util.inherits(AndActivator, LogicActivator);

AndActivator.prototype.checkActivate = function(_inputs, _currentlyActive) {

   if (_currentlyActive) {
      return false;
   }
   else {
      return _inputs.every(function (_input) {
         return _input.active;
      });
   }
};

AndActivator.prototype.checkDeactivate = function(_inputs, _currentlyActive) {
   return _currentlyActive;
};

module.exports = exports = AndActivator;
