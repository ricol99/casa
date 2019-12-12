var util = require('util');
var ConsoleApi = require('../consoleapi');

function PeerCasaConsoleApi(_config, _owner) {
   ConsoleApi.call(this, _config, _owner);
}

util.inherits(PeerCasaConsoleApi, ConsoleApi);

PeerCasaConsoleApi.prototype.filterScope = function(_scope) {
   return ConsoleApi.prototype.filterScope.call(this, _scope, this.myObj().sources);
};

PeerCasaConsoleApi.prototype.cat = function() {
   var output = [];

   for (var source in this.myObj().sources) {

      if (this.myObj().sources.hasOwnProperty(source)) {
         output.push(this.myObj().sources[source].uName);
      }
   }

   return output;
};

PeerCasaConsoleApi.prototype.sources = function() {
   var sources = [];

   for (var source in this.myObj().sources) {
      sources.push(this.myObj().sources[source].uName);
   }

   return sources;
};

PeerCasaConsoleApi.prototype.config = function() {
   return this.myObj().config;
};

module.exports = exports = PeerCasaConsoleApi;
 
