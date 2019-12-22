var util = require('util');
var ConsoleApi = require('../consoleapi');

function PropertyConsoleApi(_config, _owner) {
   ConsoleApi.call(this, _config, _owner);
   this.uName = _config.uName.split(":")[0] + "consoleapi:" + _config.uName.split(":")[1] + ":" + _config.uName.split(":")[2];
   this.name = _config.uName.split(":")[2];
   this.fullScopeName = (this.owner && this.owner.fullScopeName !== "") ? this.owner.fullScopeName+":"+this.name : this.myObjuName
}

util.inherits(PropertyConsoleApi, ConsoleApi);

PropertyConsoleApi.prototype.myObj = function() {
   var myObj = this.owner.myObj();
   return (myObj) ? myObj.props[this.name] : null;
};

PropertyConsoleApi.prototype.cat = function() {
   return this.myObj().getValue();
};

PropertyConsoleApi.prototype.getValue = function(_params, _callback) {
   return _callback(null, this.myObj().getValue());
};

PropertyConsoleApi.prototype.set = function(_params, _callback) {
   this.checkParams(1, _params);
   this.owner.setProperty([this.name, _params[0]], _callback);
};

PropertyConsoleApi.prototype.watch = function(_params, _callback) {
   this.owner.watch(_params, _callback);
};

PropertyConsoleApi.prototype.unwatch = function(_params, _callback) {
   this.owner.unwatch(_params, _callback);
};

PropertyConsoleApi.prototype.watching = function(_params, _callback) {
   _callback(null, this.owner.getWatchList().hasOwnProperty(this.name));
};

PropertyConsoleApi.prototype.listeners = function(_params, _callback) {
   this.owner.listeners(this.name, _callback);
};

module.exports = exports = PropertyConsoleApi;
 
