var ConsoleApi = require('../consoleapi');
var util = require('util');

function GangConsoleApi(_config, _owner) {
   ConsoleApi.call(this, _config, _owner);
}

util.inherits(GangConsoleApi, ConsoleApi);

GangConsoleApi.prototype.filterScope = function(_scope, _collection, _prevResult)  {
   var collection = {};
   collection[this.gang.casa.uName] = this.gang.casa;
   var result = ConsoleApi.prototype.filterScope.call(this, _scope, collection);
   return ConsoleApi.prototype.filterScope.call(this, _scope, this.gang.peerCasas, result);
};

GangConsoleApi.prototype.cat = function() {
   return false;
};

GangConsoleApi.prototype.config = function() {
   return this.gang.config;
};

GangConsoleApi.prototype.createUser = function(_uName) {

   if (!this.gang.findObject(_uName)) {
      var userObj = this.gang.createUser({uName: _uName});
      return true;
   }
   else {
      return false;
   }
};

module.exports = exports = GangConsoleApi;
 
