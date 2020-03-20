var util = require('util');
var ConsoleApi = require('../consoleapi');

function PeerCasaConsoleApi(_config, _owner) {
   ConsoleApi.call(this, _config, _owner);
}

util.inherits(PeerCasaConsoleApi, ConsoleApi);

PeerCasaConsoleApi.prototype.getCasa = function() {
   return this.myObj();
};

PeerCasaConsoleApi.prototype.filterScope = function(_scope, _collection, _prevResult, _perfectMatchRequired) {
   ConsoleApi.prototype.filterScope.call(this, _scope, this.myObj().sources, _prevResult, _perfectMatchRequired);
};

PeerCasaConsoleApi.prototype.cat = function(_params, _callback) {
   var output = [];

   for (var source in this.myObj().sources) {

      if (this.myObj().sources.hasOwnProperty(source)) {
         output.push(this.myObj().sources[source].uName);
      }
   }

   _callback(null, output);
};

PeerCasaConsoleApi.prototype.sources = function(_params, _callback) {
   var sources = [];

   for (var source in this.myObj().sources) {
      sources.push(this.myObj().sources[source].uName);
   }

   return _callback(null, sources);
};

module.exports = exports = PeerCasaConsoleApi;
 
