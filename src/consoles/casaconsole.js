var util = require('util');
var Console = require('../console');

function CasaConsole(_config, _owner) {
   Console.call(this, _config, _owner);
}

util.inherits(CasaConsole, Console);

CasaConsole.prototype.filterScope = function(_filterArray) {
   return Console.prototype.filterScope.call(this, _filterArray, this.myObj().sources);
};

CasaConsole.prototype.filterMembers = function(_filterArray, _exclusions) {
   var myExclusions = [];

   if (_exclusions) {
      return Console.prototype.filterMembers.call(this, _filterArray, myExclusions.concat(_exclusions));
   }
   else {
      return Console.prototype.filterMembers.call(this, _filterArray, myExclusions);
   }
};

CasaConsole.prototype.cat = function() {
   var output = [];

   for (var source in this.myObj().sources) {

      if (this.myObj().sources.hasOwnProperty(source)) {
         output.push(this.myObj().sources[source].uName);
      }
   }

   return output;
};

CasaConsole.prototype.config = function() {
   return this.myObj().config;
};

module.exports = exports = CasaConsole;
 
