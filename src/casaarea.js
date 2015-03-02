var util = require('util');
var Thing = require('./thing');
var CasaSystem = require('./casasystem');


function CasaArea(_obj) {
   this.casas = [];

   this.casaSys = CasaSystem.mainInstance();

   if (_obj.parentArea) {
      this.parentArea = this.casaSys.findCasaArea(_obj.parentArea);
   }
   else {
      this.parentArea = null;
   }

   Thing.call(this, _obj);

   var that = this;
}

util.inherits(CasaArea, Thing);

CasaArea.prototype.addCasa = function(_casa) {
   this.casas.push(_casa);

   this.setupCasaListeners(_casa);
}

CasaArea.prototype.setupCasaListeners = function(_casa) {
   // Do nothing, specialised classes will do more
}

module.exports = exports = CasaArea;
