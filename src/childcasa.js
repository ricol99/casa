var util = require('util');
var PeerCasa = require('./peercasa');

function ChildCasa(_config) {
   _config.proActiveConnect = false;
   PeerCasa.call(this, _config);
   this.persistent = false;
}

util.inherits(ChildCasa, PeerCasa);

module.exports = exports = ChildCasa;
