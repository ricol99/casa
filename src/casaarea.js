var util = require('util');
var Thing = require('./thing');
var CasaSystem = require('./casasystem');

function CasaArea(_config) {
   this.casas = [];
   this.casaCount = 0;

   this.casaSys = CasaSystem.mainInstance();

   Thing.call(this, _config);

   var that = this;
}

util.inherits(CasaArea, Thing);

CasaArea.prototype.addCasa = function(_casa) {
   this.casas[_casa.name] = _casa;
   this.casaCount++;

   this.setupCasaListeners(_casa);
}

CasaArea.prototype.removeCasa = function(_casa) {
   delete this.casas[_casa.name];
   this.casaCount--;
 
   this.removeCasaListeners(_casa);

   // delete area if empty!
   if (this.casaCount == 0) {
      this.casaSys.deleteCasaArea(this);
   }
}

CasaArea.prototype.removeAllCasas = function() {
  var len = this.casas.length;

   for (var i = 0 ; i < len; ++i) {
      this.casas[i].setArea(null);
   }
}

CasaArea.prototype.broadcastMessage = function(_message) {
   // Broadcasts to all my casas
   this.emit('broadcast-message', _message);
}

module.exports = exports = CasaArea;
