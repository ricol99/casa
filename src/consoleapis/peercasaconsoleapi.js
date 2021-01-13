var util = require('util');
var ConsoleApi = require('../consoleapi');

function PeerCasaConsoleApi(_config, _owner) {
   ConsoleApi.call(this, _config, _owner);
}

util.inherits(PeerCasaConsoleApi, ConsoleApi);

PeerCasaConsoleApi.prototype.getCasa = function() {
   return this.myObj();
};

PeerCasaConsoleApi.prototype.cat = function(_session, _params, _callback) {
   var output = [];

   for (var source in this.myObj().sources) {

      if (this.myObj().sources.hasOwnProperty(source)) {
         output.push(this.myObj().sources[source].name);
      }
   }

   _callback(null, output);
};

PeerCasaConsoleApi.prototype.sources = function(_session, _params, _callback) {
   var sources = [];

   for (var source in this.myObj().sources) {
      sources.push(this.myObj().sources[source].name);
   }

   return _callback(null, sources);
};

module.exports = exports = PeerCasaConsoleApi;
 
