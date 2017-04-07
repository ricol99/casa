var CasaSystem = require('./casasystem');

function Service(_config) {
   this.uName = _config.name;
   this.displayName = _config.displayName;

   this.casaSys = CasaSystem.mainInstance();
   this.casa = this.casaSys.casa;

   if (_config.secureConfig) {
      this.secureConfig = this.casaSys.loadSecureConfig(this.uName, _config);
   }
}

Service.prototype.coldStart = function() {
};

module.exports = exports = Service;
