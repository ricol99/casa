var util = require('util');
var SourceBase = require('./sourcebase');
var Gang = require('./gang');

function CasaArea(_config) {
   this.gang = Gang.mainInstance();
   this.casa = this.gang.casa;

   this.casas = {};
   this.casaCount = 0;
   this.uName = _config.uName;

   SourceBase.call(this, this.uName, this.gang.casa);
}

util.inherits(CasaArea, SourceBase);

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
      this.gang.deleteCasaArea(this);
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
