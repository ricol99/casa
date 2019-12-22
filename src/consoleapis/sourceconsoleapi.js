var util = require('util');
var SourceBaseConsoleApi = require('./sourcebaseconsoleapi');

function SourceConsoleApi(_config, _owner) {
   SourceBaseConsoleApi.call(this, _config, _owner);
}

util.inherits(SourceConsoleApi, SourceBaseConsoleApi);

SourceConsoleApi.prototype.setProperty = function(_params, _callback) {
   this.checkParams(2, _params);
   _callback(null, this.myObj().setProperty(_params[0], _params[1], {}));
};

module.exports = exports = SourceConsoleApi;
 
