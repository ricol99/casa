var util = require('util');
var ConsoleApi = require('../consoleapi');

function PropertyConsoleApi(_config, _owner) {
   ConsoleApi.call(this, _config, _owner);
}

util.inherits(PropertyConsoleApi, ConsoleApi);

// Called when current state required
PropertyConsoleApi.prototype.export = function(_exportObj) {
   ConsoleApi.prototype.export.call(this, _exportObj);
};

// Called to restore current state
PropertyConsoleApi.prototype.import = function(_importObj) {
   ConsoleApi.prototype.import.call(this, _importObj);
};

PropertyConsoleApi.prototype.coldStart = function() {
   ConsoleApi.prototype.coldStart.call(this);
};

PropertyConsoleApi.prototype.hotStart = function() {
   ConsoleApi.prototype.hotStart.call(this);
};

PropertyConsoleApi.prototype.cat = function(_session, _params, _callback) {
   _callback(null, this.myObj().getValue());
};

PropertyConsoleApi.prototype.getValue = function(_session, _params, _callback) {
   return _callback(null, this.myObj().getValue());
};

PropertyConsoleApi.prototype.set = function(_session, _params, _callback) {
   this.checkParams(1, _params);
   this.owner.setProperty(_session, [this.name, _params[0]], _callback);
};

PropertyConsoleApi.prototype.watch = function(_session, _params, _callback) {
   this.owner.watch(_session, [this.name], _callback);
};

PropertyConsoleApi.prototype.unwatch = function(_session, _params, _callback) {
   this.owner.unwatch(_session, [this.name], _callback);
};

PropertyConsoleApi.prototype.watching = function(_session, _params, _callback) {
   _callback(null, this.owner.getWatchList().hasOwnProperty(this.name));
};

PropertyConsoleApi.prototype.listeners = function(_session, _params, _callback) {
   this.owner.listeners(_session, [this.name], _callback);
};

module.exports = exports = PropertyConsoleApi;
 
