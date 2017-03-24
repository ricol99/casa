var CasaSystem = require('./casasystem');

function Service(_config) {
   this.uName = _config.name;
   this.displayName = _config.displayName;

   var casaSys = CasaSystem.mainInstance();
   this.casa = casaSys.casa;
}

Service.prototype.coldStart = function() {
};

module.exports = exports = Service;
