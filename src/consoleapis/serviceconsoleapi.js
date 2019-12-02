var util = require('util');
var SourceBaseConsoleApi = require('./sourcebaseconsoleapi');

function ServiceConsoleApi(_config, _owner) {
   SourceBaseConsoleApi.call(this, _config, _owner);
}

util.inherits(ServiceConsoleApi, SourceBaseConsoleApi);

ServiceConsoleApi.prototype.setProperty = function(_property, _value) {
   return this.myObj().setProperty(_property, _value, {});
};

ServiceConsoleApi.prototype.config = function() {
   return this.myObj().config;
};

module.exports = exports = ServiceConsoleApi;
 
