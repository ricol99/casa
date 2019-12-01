var util = require('util');
var SourceBaseConsoleApi = require('./sourcebaseconsoleapi');

function SourceConsoleApi(_config, _owner) {
   SourceBaseConsoleApi.call(this, _config, _owner);
}

util.inherits(SourceConsoleApi, SourceBaseConsoleApi);

SourceConsoleApi.prototype.setProperty = function(_property, _value) {
   return this.myObj().setProperty(_property, _value, {});
};

SourceConsoleApi.prototype.config = function() {
   return this.myObj().config;
};

module.exports = exports = SourceConsoleApi;
 
