var util = require('util');
var ConsoleApi = require('../consoleapi');

function GlobalConsoleApi(_config, _owner) {
   ConsoleApi.call(this, { uName: "" });
}

util.inherits(GlobalConsoleApi, ConsoleApi);

GlobalConsoleApi.prototype.filterScope = function(_scope, _collection, _prevResult, _perfectMatchRequired) {
   var collection = {};
   //collection[this.gang.uName] = this.gang;
   ConsoleApi.prototype.filterScope.call(this, _scope, this.gang.allObjects, _prevResult, _perfectMatchRequired);
};

module.exports = exports = GlobalConsoleApi;
 
