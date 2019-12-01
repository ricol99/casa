var ConsoleApi = require('../consoleapi');
var util = require('util');

function GangConsoleApi(_config, _owner) {
   ConsoleApi.call(this, _config, _owner);
   this.fullScopeName = ":";
   this.myObjuName = ":";
   this.consoleApiObjects[this.myObjuName] = this;
}

util.inherits(GangConsoleApi, ConsoleApi);

GangConsoleApi.prototype.filterScope = function(_scope, _collection, _prevResult)  {
   var collection = {};
   collection[this.gang.casa.uName] = this.gang.casa;
   var result = ConsoleApi.prototype.filterScope.call(this, _scope.replace("::", ""), collection);
   return ConsoleApi.prototype.filterScope.call(this, _scope.replace("::", ""), this.gang.peerCasas, result);
};

GangConsoleApi.prototype.cat = function() {
   return false;
};

GangConsoleApi.prototype.config = function() {
   return this.gang.config;
};

module.exports = exports = GangConsoleApi;
 
