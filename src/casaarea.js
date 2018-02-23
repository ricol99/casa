var util = require('util');
var Thing = require('./thing');
var CasaSystem = require('./casasystem');

function CasaArea(_config) {
   this.casaSys = CasaSystem.mainInstance();
   this.casa = this.casaSys.casa;

   this.casas = {};
   this.casaCount = 0;
   this.name = _config.name;

   Thing.call(this, _config);
}

util.inherits(CasaArea, Thing);

CasaArea.prototype.addCasa = function(_casa) {
   this.casas[_casa.uName] = _casa;
   this.casaCount++;

   this.setupCasaListeners(_casa);
}

CasaArea.prototype.removeCasa = function(_casa) {
   delete this.casas[_casa.uName];
   this.casaCount--;
 
   this.removeCasaListeners(_casa);

   // delete area if empty!
   if (this.casaCount == 0) {
      this.casaSys.deleteCasaArea(this);
   }
}

CasaArea.prototype.removeAllCasas = function() {
  var len = this.casas.length;

   for (var prop in this.casas) {

      if (this.casas.hasOwnProperty(prop)) {
         this.casas[prop].setArea(null);
      }
   }
}

CasaArea.prototype.broadcastMessage = function(_message) {
   // Broadcasts to all my casas
   this.emit('broadcast-message', _message);
}

module.exports = exports = CasaArea;
