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

CasaArea.prototype.setUber = function(_casa) {
   this.casas['UBER'] = _casa;
}

CasaArea.prototype.setupCasaListeners = function(_casa) {
   var that = this;
   // TBD Add listeners and logic

   // BROADCASTING local broadcast (this casa's peer states and activators) already done by peer casa class
   // BROADCASTING Broadcast to area this casa is running in (not the child casa area);
   // BROADCASTING Broadcast to parent area (Uber casa) of the casa we are running in (not the the parent area of this child casa area);
   // BROADCASTING Broadcast to child areas (Uber casa) of the casa we are running in except source area (not the the parent area of this child casa area);

   if (this.casaSys.isUberCasa()) {

      _casa.on('broadcast-message', function(_message) {

         if (_mes.namesage.sourceCasa == that.casaSys.casa.name) {
            // source is the main Casa
            // Ignore at the moment as the broadcast is currently handled by Casa and PeerCasa objects - not nice but not changing it at the moment!
	    console.log(that.name + ': Event received from casa. Event name: ' + _message.message +', source: ' + _message.data.sourceName);
         }
         else {
            // source is a peer casa
	    console.log(that.name + ': Event received from peercasa. Event name: ' + _message.message +', source: ' + _message.data.sourceName);

            that.casaSys.areas.forEach(function(_area) {
               console.log(that.name + ': Possible sibling child area ' + _area.name);

               if ((_area != that) && (_area.parentArea == that.area)) {
                  console.log(that.name + ': Broadcasting to child area ' + _area.name);
                  _area.broadcastMessage(_message);
               }
            });
         }
      });

      // FORWARDING If my casa is the target, peer casa class takes care of this
      // FORWARDING If my area is the target, find peer casa and forward
      // FORWARDING If my area is not the target, is the area a child area of mine? YES - forward to next hop for child. NO - forward to parent

      _casa.on('forward-request', function(_data) {
         console.log(that.name + ': Forward event request from child. State: ' + _data.data.stateName);

         if (this.casaSys.isUberCasa()) {
         }
      });

      _casa.on('forward-response', function(_data) {
         console.log(that.name + ': Forward event response from child. State: ' + _data.data.stateName);

         if (this.casaSys.isUberCasa()) {
         }
      });
   }
}

CasaArea.prototype.broadcastMessage = function(_message) {
   // Broadcasts to all my casas
   this.emit('broadcast-message', _message);
}

module.exports = exports = CasaArea;
