var util = require('util');
var PeerCasa = require('./peercasa');

function ParentCasa(_obj) {

   _obj.proActiveConnect = true;

   PeerCasa.call(this, _obj);

   var that = this;

}

util.inherits(ParentCasa, PeerCasa);

module.exports = exports = ParentCasa;
