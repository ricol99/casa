var util = require('util');
var SourceConsoleApi = require('./sourceconsoleapi');
var ConsoleApi = require('../consoleapi');

function ThingConsoleApi(_config, _owner) {
   SourceConsoleApi.call(this, _config, _owner);
}

util.inherits(ThingConsoleApi, SourceConsoleApi);

ThingConsoleApi.prototype.filterScope = function(_scope) {
   var result = SourceConsoleApi.prototype.filterScope.call(this, _scope);
   return ConsoleApi.prototype.filterScope.call(this, _scope, this.myObj().things, result);
};

ThingConsoleApi.prototype.cat = function() {
   var output = SourceConsoleApi.prototype.cat.call(this);

   if (this.myObj().things.length > 0) {

      for (var thing in this.myObj().things) {

         if (this.myObj().things.hasOwnProperty(thing)) {
            output.push(this.myObj().things[thing].uName);
         }
      }
   }

   return output;
};

module.exports = exports = ThingConsoleApi;
 
