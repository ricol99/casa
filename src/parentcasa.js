var util = require('util');
var PeerCasa = require('./peercasa');

function ParentCasa(_config) {
   _config.proActiveConnect = true;

   PeerCasa.call(this, _config);
   this.loginAs = 'child';
   this.persistent = true;
   this.socketOptions.reconnection = true;
   this.socketOptions.reconnectionDelay = 1000;
   this.socketOptions.reconnectionDelayMax = 5000;
   this.socketOptions.reconnectionAttempts = 99999;
}

util.inherits(ParentCasa, PeerCasa);

ParentCasa.prototype.broadcastIfNecessary = function(_messageName, _messageData) {
   // Do something - specialised classes may have different behavior
}

ParentCasa.prototype.forwardIfNecessary = function(_messageName, _messageData) {
   // Do something - specialised classes may have different behavior
}

module.exports = exports = ParentCasa;
