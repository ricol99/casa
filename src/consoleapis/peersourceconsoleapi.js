var util = require('util');
var PeerSourceBaseConsoleApi = require('./sourcebaseconsoleapi');

function PeerSourceConsoleApi(_config, _owner) {
   SourceBaseConsoleApi.call(this, _config, _owner);
}

util.inherits(PeerSourceConsoleApi, SourceBaseConsoleApi);

PeerSourceConsoleApi.prototype.getCasa = function() {
   return this.myObj().casa;
};

module.exports = exports = PeerSourceConsoleApi;
 
