var util = require('util');
var PeerSourceBaseConsoleApi = require('./sourcebaseconsoleapi');

function PeerSourceConsoleApi(_config, _owner) {
   SourceBaseConsoleApi.call(this, _config, _owner);
}

util.inherits(PeerSourceConsoleApi, SourceBaseConsoleApi);

PeerSourceConsoleApi.prototype.config = function() {
   return this.myObj().config;
};

module.exports = exports = PeerSourceConsoleApi;
 
