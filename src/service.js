var Gang = require('./gang');

function Service(_config) {
   this.uName = _config.uName;
   this.displayName = _config.displayName;

   this.gang = Gang.mainInstance();
   this.casa = this.gang.casa;
}

Service.prototype.coldStart = function() {
};

module.exports = exports = Service;
