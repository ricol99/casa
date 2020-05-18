var util = require('util');
var ConsoleApi = require('../consoleapi');

function GlobalConsoleApi(_config, _owner) {
   ConsoleApi.call(this, { name: "", type: "globalconsoleapi" });
}

util.inherits(GlobalConsoleApi, ConsoleApi);

GlobalConsoleApi.prototype.filterScope = function(_scope, _collection, _prevResult, _perfectMatchRequired) {
   var collection = {};
   //collection[this.gang.name] = this.gang;
   ConsoleApi.prototype.filterScope.call(this, _scope, this.gang.allObjects, _prevResult, _perfectMatchRequired);
};

module.exports = exports = GlobalConsoleApi;
 
