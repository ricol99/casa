var util = require('util');
var Thing = require('./thing');
var limb = require('limb')

function PeerCasa(_name, _displayName, _address, _owner, _props) {
   this.address = _address;
   
   Thing.call(this, 'peer-casa:' + _name, _displayName, _owner, _props);
   var that = this;

}

util.inherits(PeerCasa, Thing);

PeerCasa.prototype.getHostname = function() {
   return this.address.hostName;
};

PeerCasa.prototype.getPort = function() {
   return this.address.port;
};

module.exports = exports = PeerCasa;

