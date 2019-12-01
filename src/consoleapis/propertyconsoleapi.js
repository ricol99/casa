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

PropertyConsoleApi.prototype.getValue = function() {
   return this.myObj().getValue();
};

PropertyConsoleApi.prototype.set = function(_value) {
   return this.owner.setProperty(this.name, _value);
};

PropertyConsoleApi.prototype.watch = function() {
   return this.owner.watch(this.name);
};

PropertyConsoleApi.prototype.unwatch = function() {
   return this.owner.unwatch(this.name);
};

PropertyConsoleApi.prototype.watching = function() {
   return this.owner.getWatchList().hasOwnProperty(this.name);
};

PropertyConsoleApi.prototype.listeners = function() {
   return this.owner.listeners(this.name);
};

module.exports = exports = PropertyConsoleApi;
 
