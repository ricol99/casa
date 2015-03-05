var util = require('util');
var PeerCasa = require('./peercasa');

function ParentCasa(_config) {

   _config.proActiveConnect = true;

   PeerCasa.call(this, _config);

   var that = this;

}

util.inherits(ParentCasa, PeerCasa);

ParentCasa.prototype.broadcastIfNecessary = function(_messageName, _messageData) {
   // Do something - specialised classes may have different behavior
}

ParentCasa.prototype.forwardIfNecessary = function(_messageName, _messageData) {
   // Do something - specialised classes may have different behavior
}

module.exports = exports = ParentCasa;
