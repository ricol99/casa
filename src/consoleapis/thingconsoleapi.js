var util = require('util');
var SourceConsoleApi = require('./sourceconsoleapi');
var ConsoleApi = require('../consoleapi');

function ThingConsoleApi(_config, _owner) {
   SourceConsoleApi.call(this, _config, _owner);
}

util.inherits(ThingConsoleApi, SourceConsoleApi);

ThingConsoleApi.prototype.filterScope = function(_scope) {
   var result = SourceConsoleApi.prototype.filterScope.call(this, _scope);
   return ConsoleApi.prototype.filterScope.call(this, _scope, this.myObj().things, result);
};

module.exports = exports = ThingConsoleApi;
 
