var util = require('util');
var ConsoleApi = require('../consoleapi');

function CasaConsoleApi(_config, _owner) {
   ConsoleApi.call(this, _config, _owner);
}

util.inherits(CasaConsoleApi, ConsoleApi);

CasaConsoleApi.prototype.filterScope = function(_scope) {
   var result = ConsoleApi.prototype.filterScope.call(this, _scope, this.myObj().sources);
   return ConsoleApi.prototype.filterScope.call(this, _scope, this.gang.services, result);
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

CasaConsoleApi.prototype.sources = function() {
   var sources = [];

   for (var source in this.myObj().sources) {
      sources.push(this.myObj().sources[source].uName);
   }
   return sources;
};

CasaConsoleApi.prototype.config = function() {
   return this.myObj().config;
};

CasaConsoleApi.prototype.restart = function() {
   process.exit(3);
};

module.exports = exports = CasaConsoleApi;
 
