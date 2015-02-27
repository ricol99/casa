var util = require('util');
var PeerCasa = require('./peercasa');

function ChildCasa(_obj) {

   _obj.proActiveConnect = false;

   PeerCasa.call(this, _obj);

   var that = this;

}

util.inherits(ChildCasa, PeerCasa);

ChildCasa.prototype.broadcastIfNecessary = function(_messageName, _messageData) {
   // Do something - specialised classes may have different behavior
}

ChildCasa.prototype.forwardIfNecessary = function(_messageName, _messageData) {
   // Do something - specialised classes may have different behavior
}

module.exports = exports = ChildCasa;
