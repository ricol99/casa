var util = require('util');
var ConsoleApi = require('../consoleapi');

function CasaConsoleApi(_config, _owner) {
   ConsoleApi.call(this, _config, _owner);
}

util.inherits(CasaConsoleApi, ConsoleApi);

CasaConsoleApi.prototype.filterScope = function(_scope) {
   return ConsoleApi.prototype.filterScope.call(this, _scope, this.myObj().sources);
};

CasaConsoleApi.prototype.cat = function() {
   var output = [];

   for (var source in this.myObj().sources) {

      if (this.myObj().sources.hasOwnProperty(source)) {
         output.push(this.myObj().sources[source].uName);
      }
   }

   return output;
};

CasaConsoleApi.prototype.config = function() {
   return this.myObj().config;
};

module.exports = exports = CasaConsoleApi;
 
