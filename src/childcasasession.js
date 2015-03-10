var util = require('util');
var PeerCasaSession = require('./peercasasession');

function ChildCasaSession(_config) {

   _config.proActiveConnect = false;

   PeerCasaSession.call(this, _config);

   var that = this;

}

util.inherits(ChildCasaSession, PeerCasaSession);


module.exports = exports = ChildCasaSession;
