var util = require('util');
var ServiceConsoleApi = require('./serviceconsoleapi');

function BtleServiceConsoleApi(_config, _owner) {
   ServiceConsoleApi.call(this, _config, _owner);
}

util.inherits(BtleServiceConsoleApi, ServiceConsoleApi);

BtleServiceConsoleApi.prototype.scan = function(_session, _params, _callback) {
   this.checkParams(0, _params);
   this.myObj().scanOnce(undefined, _callback);
};

module.exports = exports = BtleServiceConsoleApi;
 
