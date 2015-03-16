var util = require('util');
var CasaArea = require('./casaarea');

function PeerCasaArea(_config) {

   CasaArea.call(this, _config);

   var that = this;

   this.broadcastListener = function(_message) {
      console.log(that.name + ': Event received from peercasa. Event name: ' + _message.message +', source: ' + _message.data.sourceName);

      // Broadcast to all children - peers and parent already know
      for(var prop in that.casaSys.childCasaAreas) {

         if(that.casaSys.childCasaAreas.hasOwnProperty(prop)){
            console.log(that.name + ': Broadcasting to child area ' + that.casaSys.childCasaAreas[prop].name);
            that.casaSys.childCasaAreas[prop].broadcastMessage(_message);
         }
      }
   };

   this.forwardRequestListener = function(_data) {
      console.log(that.name + ': Forward event request from peer. State: ' + _data.data.stateName);
   };

   this.forwardResponseListener = function(_data) {
      console.log(that.name + ': Forward event response from peer. State: ' + _data.data.stateName);
   };
}

util.inherits(PeerCasaArea, CasaArea);

PeerCasaArea.prototype.buildCasaForwardingList = function() {
   var casaList = [];

   // My peer
   casaList.push(this.casaSys.casa);

   // All my peer's children
   for (var prop in this.casaSys.childCasaAreas) {

      if (this.casaSys.childCasaAreas.hasOwnProperty(prop)){
         var childCasaArea = this.casaSys.childCasaAreas[prop];

         for(var prop2 in childCasaArea.casas) {

            if (childCasaArea.casas.hasOwnProperty(prop2)){
               casaList.push(childCasaArea.casas[prop2]);
            }
         }
      }
   }

   return casaList;
}

PeerCasaArea.prototype.setupCasaListeners = function(_casa) {
   var that = this;

   if (this.casaSys.isUberCasa()) {

      // BROADCASTING local broadcast (this casa's peer states and activators) already done by peer casa class
      // BROADCASTING Broadcast to area this casa is running in (not the child casa area);
      // BROADCASTING Broadcast to parent area (Uber casa) of the casa we are running in (not the the parent area of this child casa area);
      // BROADCASTING Broadcast to child areas (Uber casa) of the casa we are running in except source area (not the the parent area of this child casa area);

      _casa.on('broadcast-message', this.broadcastListener);

      // TBD
      // FORWARDING If my casa is the target, peer casa class takes care of this
      // FORWARDING If my area is the target, find peer casa and forward
      // FORWARDING If my area is not the target, is the area a child area of mine? YES - forward to next hop for child. NO - forward to parent

      _casa.on('forward-request', this.forwardRequestListener);

      _casa.on('forward-response', this.forwardResponseListener);
   }
}

PeerCasaArea.prototype.removeCasaListeners = function(_casa) {

   if (this.casaSys.isUberCasa()) {
      _casa.removeListener('broadcast-message', this.broadcastListener);
      _casa.removeListener('forward-request', this.forwardRequestListener);
      _casa.removeListener('forward-response', this.forwardResponseListener);
   }
}

module.exports = exports = PeerCasaArea;
