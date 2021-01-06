var util = require('util');
var ConsoleApi = require('../consoleapi');

function PropertyConsoleApi(_config, _owner) {
   ConsoleApi.call(this, _config, _owner);
}

util.inherits(PropertyConsoleApi, ConsoleApi);

PropertyConsoleApi.prototype.cat = function(_session, _params, _callback) {
   _callback(null, this.myObj().getValue());
};

PropertyConsoleApi.prototype.getValue = function(_session, _params, _callback) {
   return _callback(null, this.myObj().getValue());
};

PropertyConsoleApi.prototype.set = function(_session, _params, _callback) {
   this.checkParams(1, _params);
   this.owner.setProperty([this.name, _params[0]], _callback);
};

PropertyConsoleApi.prototype.watch = function(_session, _params, _callback) {
   this.owner.watch(_session, _params, _callback);
};

PropertyConsoleApi.prototype.unwatch = function(_session, _params, _callback) {
   this.owner.unwatch(_session, _params, _callback);
};

PropertyConsoleApi.prototype.watching = function(_session, _params, _callback) {
   _callback(null, this.owner.getWatchList().hasOwnProperty(this.name));
};

PropertyConsoleApi.prototype.listeners = function(_session, _params, _callback) {
   this.owner.listeners([this.name], _callback);
};

module.exports = exports = PropertyConsoleApi;
 
