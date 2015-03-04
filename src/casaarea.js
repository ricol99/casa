var util = require('util');
var Thing = require('./thing');
var CasaSystem = require('./casasystem');


function CasaArea(_config) {
   this.casas = [];

   this.casaSys = CasaSystem.mainInstance();

   if (_config.parentArea) {
      this.parentArea = this.casaSys.findCasaArea(_config.parentArea);
   }
   else {
      this.parentArea = null;
   }

   Thing.call(this, _config);

   var that = this;
}

util.inherits(CasaArea, Thing);

CasaArea.prototype.addCasa = function(_casa) {
   this.casas[_casa.name] = _casa;;

   this.setupCasaListeners(_casa);
}

CasaArea.prototype.setupCasaListeners = function(_casa) {
   // Do nothing, specialised classes will do more
}

CasaArea.prototype.createRoutes = function() {
   // Do nothing, specialised classes will do more
}

module.exports = exports = CasaArea;
