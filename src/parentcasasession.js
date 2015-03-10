var util = require('util');
var PeerCasaSession = require('./peercasasession');

function ParentCasa(_config) {

   _config.proActiveConnect = true;

   PeerCasaSession.call(this, _config);

   var that = this;

}

util.inherits(ParentCasa, PeerCasaSession);

ParentCasa.prototype.broadcastIfNecessary = function(_messageName, _messageData) {
   // Do something - specialised classes may have different behavior
}

ParentCasa.prototype.forwardIfNecessary = function(_messageName, _messageData) {
   // Do something - specialised classes may have different behavior
}

module.exports = exports = ParentCasa;
