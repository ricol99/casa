var util = require('util');
var SourceBaseConsoleApi = require('./sourcebaseconsoleapi');

function ServiceConsoleApi(_config, _owner) {
   SourceBaseConsoleApi.call(this, _config, _owner);
}

util.inherits(ServiceConsoleApi, SourceBaseConsoleApi);

module.exports = exports = ServiceConsoleApi;
 
