var util = require('util');
var ServiceConsoleApi = require('./serviceconsoleapi');

function BtleServiceConsoleApi(_config, _owner) {
   ServiceConsoleApi.call(this, _config, _owner);
}

util.inherits(BtleServiceConsoleApi, ServiceConsoleApi);

// Called when current state required
BtleServiceConsoleApi.prototype.export = function(_exportObj) {
   ServiceConsoleApi.prototype.export.call(this, _exportObj);
};

// Called to restore current state
BtleServiceConsoleApi.prototype.import = function(_importObj) {
   ServiceConsoleApi.prototype.import.call(this, _importObj);
};

BtleServiceConsoleApi.prototype.coldStart = function() {
   ServiceConsoleApi.prototype.coldStart.call(this);
};

BtleServiceConsoleApi.prototype.hotStart = function() {
   ServiceConsoleApi.prototype.hotStart.call(this);
};

BtleServiceConsoleApi.prototype.scan = function(_session, _params, _callback) {
   this.checkParams(0, _params);
   this.myObj().scanOnce(undefined, _callback);
};

module.exports = exports = BtleServiceConsoleApi;
 
