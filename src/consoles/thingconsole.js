var util = require('util');
var SourceConsole = require('./sourceconsole');
var Console = require('../console');

function ThingConsole(_config, _owner) {
   SourceConsole.call(this, _config, _owner);
}

util.inherits(ThingConsole, SourceConsole);

ThingConsole.prototype.filterScope = function(_filterArray) {
   var result = SourceConsole.prototype.filterScope.call(this, _filterArray);
   return Console.prototype.filterScope.call(this, _filterArray, this.myObj().things, result);
};

ThingConsole.prototype.cat = function() {
   var output = SourceConsole.prototype.cat.call(this);

   if (this.myObj().things.length > 0) {

      for (var thing in this.myObj().things) {

         if (this.myObj().things.hasOwnProperty(thing)) {
            output.push(this.myObj().things[thing].uName);
         }
      }
   }

   return output;
};

module.exports = exports = ThingConsole;
 
