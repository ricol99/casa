var util = require('util');
var ConsoleApi = require('../consoleapi');

function GlobalConsoleApi(_config, _owner) {
   ConsoleApi.call(this, _config, _owner);
   this.fullScopeName = "";
   this.myObjuName = "";
}

util.inherits(GlobalConsoleApi, ConsoleApi);

GlobalConsoleApi.prototype.filterScope = function(_scope) {
   var collection = {};
   collection[this.gang.uName] = this.gang;
   return ConsoleApi.prototype.filterScope.call(this, _scope, collection);
};

module.exports = exports = GlobalConsoleApi;
 
