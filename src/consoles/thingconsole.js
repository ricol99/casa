var util = require('util');
var SourceBaseConsole = require('./sourcebaseconsole');
var Console = require('../console');

function ThingConsole(_config, _owner) {
   SourceBaseConsole.call(this, _config, _owner);
}

util.inherits(ThingConsole, SourceBaseConsole);

ThingConsole.prototype.filterScope = function(_filterArray) {
   var result = SourceBaseConsole.prototype.filterScope.call(this, _filterArray);
   return Console.prototype.filterScope.call(this, _filterArray, this.myObj().things, result);
};

ThingConsole.prototype.filterMembers = function(_filterArray) {
   return SourceBaseConsole.prototype.filterMembers.call(this, _filterArray, []);
};

ThingConsole.prototype.cat = function() {
   var output = SourceBaseConsole.prototype.cat.call(this);

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
 
