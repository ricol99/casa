var Gang = require('./gang');

var _gangInstance = null;

function Service(_config) {
   this.confg = _config;
   this.uName = _config.uName;
   this.displayName = _config.displayName;

   this.gang = (_gangInstance) ? _gangInstance : Gang.mainInstance();
   this.casa = this.gang.casa;
}

Service.prototype.coldStart = function() {
};

Service.setGang = function(_gang) {
   _gangInstance = _gang;
}

module.exports = exports = Service;
