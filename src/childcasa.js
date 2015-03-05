var util = require('util');
var PeerCasa = require('./peercasa');

function ChildCasa(_config) {

   _config.proActiveConnect = false;

   PeerCasa.call(this, _config);

   var that = this;

}

util.inherits(ChildCasa, PeerCasa);


module.exports = exports = ChildCasa;
