var util = require('util');
var PeerSourceBaseConsoleApi = require('./sourcebaseconsoleapi');

function PeerSourceConsoleApi(_config, _owner) {
   SourceBaseConsoleApi.call(this, _config, _owner);
}

util.inherits(PeerSourceConsoleApi, SourceBaseConsoleApi);

// Called when current state required
PeerSourceConsoleApi.prototype.export = function(_exportObj) {
   SourceBaseConsoleApi.prototype.export.call(this, _exportObj);
};

// Called to restore current state
PeerSourceConsoleApi.prototype.import = function(_importObj) {
   SourceBaseConsoleApi.prototype.import.call(this, _importObj);
};

PeerSourceConsoleApi.prototype.coldStart = function() {
   SourceBaseConsoleApi.prototype.coldStart.call(this);
};

PeerSourceConsoleApi.prototype.hotStart = function() {
   SourceBaseConsoleApi.prototype.hotStart.call(this);
};

PeerSourceConsoleApi.prototype.getCasa = function() {
   return this.myObj().casa;
};

module.exports = exports = PeerSourceConsoleApi;
 
