var util = require('util');
var PeerCasa = require('./peercasa');

function ChildCasa(_obj) {

   _obj.proActiveConnect = false;

   PeerCasa.call(this, _obj);

   var that = this;

}

util.inherits(ChildCasa, PeerCasa);


module.exports = exports = ChildCasa;
