var util = require('util');
var ConsoleApi = require('../consoleapi');

function PeerCasaConsoleApi(_config, _owner) {
   ConsoleApi.call(this, _config, _owner);
}

util.inherits(PeerCasaConsoleApi, ConsoleApi);

// Called when current state required
PeerCasaConsoleApi.prototype.export = function(_exportObj) {
   ConsoleApi.prototype.export.call(this, _exportObj);
};

// Called to restore current state
PeerCasaConsoleApi.prototype.import = function(_importObj) {
   ConsoleApi.prototype.import.call(this, _importObj);
};

PeerCasaConsoleApi.prototype.coldStart = function() {
   ConsoleApi.prototype.coldStart.call(this);
};

PeerCasaConsoleApi.prototype.hotStart = function() {
   ConsoleApi.prototype.hotStart.call(this);
};

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
 
