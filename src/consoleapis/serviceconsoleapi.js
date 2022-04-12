var util = require('util');
var SourceBaseConsoleApi = require('./sourcebaseconsoleapi');

function ServiceConsoleApi(_config, _owner) {
   SourceBaseConsoleApi.call(this, _config, _owner);
}

util.inherits(ServiceConsoleApi, SourceBaseConsoleApi);

// Called when current state required
ServiceConsoleApi.prototype.export = function(_exportObj) {
   SourceBaseConsoleApi.prototype.export.call(this, _exportObj);
};

// Called to restore current state
ServiceConsoleApi.prototype.import = function(_importObj) {
   SourceBaseConsoleApi.prototype.import.call(this, _importObj);
};

ServiceConsoleApi.prototype.coldStart = function() {
   SourceBaseConsoleApi.prototype.coldStart.call(this);
};

ServiceConsoleApi.prototype.hotStart = function() {
   SourceBaseConsoleApi.prototype.hotStart.call(this);
};

module.exports = exports = ServiceConsoleApi;
 
