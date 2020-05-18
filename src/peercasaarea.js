var util = require('util');
var CasaArea = require('./casaarea');

function PeerCasaArea(_config) {
   CasaArea.call(this, _config);

   this.broadcastListener = PeerCasaArea.prototype.broadcastCb.bind(this);
   this.forwardRequestListener = PeerCasaArea.prototype.forwardRequestCb.bind(this);
   this.forwardResponseListener = PeerCasaArea.prototype.forwardResponseCb.bind(this);
}

util.inherits(PeerCasaArea, CasaArea);

PeerCasaArea.prototype.broadcastCb = function(_message) {
   console.log(this.uName + ': Event received from peercasa. Event name: ' + _message.message +', source: ' + _message.data.sourceName);

   // Broadcast to all children - peers and parent already know
   for(var prop in this.gang.childCasaAreas) {

      if(this.gang.childCasaAreas.hasOwnProperty(prop)){
         console.log(this.uName + ': Broadcasting to child area ' + this.gang.childCasaAreas[prop].name);
         this.gang.childCasaAreas[prop].broadcastMessage(_message);
      }
   }
};

PeerCasaArea.prototype.forwardRequestCb = function(_data) {
   console.log(this.uName + ': Forward event request from peer. Source: ' + _data.data.sourceName);
};

PeerCasaArea.prototype.forwardResponseCb = function(_data) {
   console.log(this.uName + ': Forward event response from peer. Source: ' + _data.data.sourceName);
};

PeerCasaArea.prototype.buildCasaForwardingList = function() {
   var casaList = [];

   // My peer
   casaList.push(this.gang.casa);

   // All my peer's children
   for (var prop in this.gang.childCasaAreas) {

      if (this.gang.childCasaAreas.hasOwnProperty(prop)){
         var childCasaArea = this.gang.childCasaAreas[prop];

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

   if (this.gang.isUberCasa()) {

      // BROADCASTING local broadcast (this casa's peer sources) already done by peer casa class
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

   if (this.gang.isUberCasa()) {
      _casa.removeListener('broadcast-message', this.broadcastListener);
      _casa.removeListener('forward-request', this.forwardRequestListener);
      _casa.removeListener('forward-response', this.forwardResponseListener);
   }
}

module.exports = exports = PeerCasaArea;
