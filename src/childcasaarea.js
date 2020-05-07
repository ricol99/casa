var util = require('util');
var CasaArea = require('./casaarea');
var Gang = require('./gang');

function ChildCasaArea(_config) {
   this.gang = Gang.mainInstance();
   CasaArea.call(this, _config);

   this.broadcastListener = ChildCasaArea.prototype.broadcastCb.bind(this);
   this.forwardRequestListener = ChildCasaArea.prototype.forwardRequestCb.bind(this);
   this.forwardResponseListener = ChildCasaArea.prototype.forwardResponseCb.bind(this);
}

util.inherits(ChildCasaArea, CasaArea);

ChildCasaArea.prototype.broadcastCb = function(_message) {
   console.log(this.fullName + ': Event received from child. Event name: ' + _message.message +', source: ' + _message.data.sourceName);

   // Broadcast to all my siblings
   for(var prop in this.gang.childCasaAreas) {

      if(this.gang.childCasaAreas.hasOwnProperty(prop)){
         var childCasaArea = this.gang.childCasaAreas[prop];

         // Is the area a sibling?
         if (childCasaArea != this) {
            console.log(this.fullName + ': Broadcasting to child area ' + childCasaArea.uName);
            childCasaArea.broadcastMessage(_message);
         }
      }
   }

   if (this.gang.peerCasaArea) {
      this.gang.peerCasaArea.broadcastMessage(_message);
   }

   if (this.gang.parentCasaArea) {
      this.parentCasaArea.broadcastMessage(_message);
   }
};

ChildCasaArea.prototype.forwardRequestCb = function(_data) {
   console.log(this.fullName + ': Forward event request from child. Source: ' + _data.data.sourceName);
};

ChildCasaArea.prototype.forwardResponseCb = function(_data) {
   console.log(this.fullName + ': Forward event response from child. Source: ' + _data.data.sourceName);
};

ChildCasaArea.prototype.buildCasaForwardingList = function() {
   var casaList = [];

   // My parent
   casaList.push(this.gang.casa);

   // All my siblings
   for (var prop in this.gang.childCasaAreas) {

      if (this.gang.childCasaAreas.hasOwnProperty(prop)){
         var childCasaArea = this.gang.childCasaAreas[prop];

         // Is the area a sibling?
         if (childCasaArea != this) {

            for(var prop2 in childCasaArea.casas) {

               if (childCasaArea.casas.hasOwnProperty(prop2)){
                  casaList.push(childCasaArea.casas[prop2]);
               }
            }
         }
      }
   }

   if (this.gang.peerCasaArea) {
      // All my uncles and aunties
      for(var prop3 in this.gang.peerCasaArea.casas) {

         if (this.gang.peerCasaArea.casas.hasOwnProperty(prop3)){
            casaList.push(this.gang.peerCasaArea.casas[prop3]);
         }
      }
   }

   if (this.gang.parentCasaArea) {
      // My grand parent
      casaList.push(this.gang.parentCasaArea.casas[0]);
   }

   // Any remotes my parent is aware of
   for(var prop4 in this.gang.remoteCasas) {

      if ((this.gang.remoteCasas.hasOwnProperty(prop4)) && this.gang.remoteCasas[prop4] && (this.gang.remoteCasas[prop4].loginAs == 'remote')) {
         casaList.push(this.gang.remoteCasas[prop4]);
      }
   }

   return casaList;
}

ChildCasaArea.prototype.setupCasaListeners = function(_casa) {

   // BROADCASTING local broadcast (this casa's peer sources) already done by peer casa class
   // BROADCASTING Broadcast to area this casa is running in (not the child casa area);
   // BROADCASTING Broadcast to parent area (Uber casa) of the casa we are running in (not the the parent area of this child casa area);
   // BROADCASTING Broadcast to child areas (Uber casa) of the casa we are running in except source area (not the the parent area of this child casa area);

   if (this.gang.isUberCasa()) {

      _casa.on('broadcast-message', this.broadcastListener);

      // TBD
      // FORWARDING If my casa is the target, peer casa class takes care of this
      // FORWARDING If my area is the target, find peer casa and forward
      // FORWARDING If my area is not the target, is the area a child area of mine? YES - forward to next hop for child. NO - forward to parent

      _casa.on('forward-request', this.forwardRequestListener);

      _casa.on('forward-response', this.forwardResponseListener);
   }
}

ChildCasaArea.prototype.removeCasaListeners = function(_casa) {

   if (this.gang.isUberCasa()) {
      _casa.removeListener('broadcast-message', this.broadcastListener);
      _casa.removeListener('forward-request', this.forwardRequestListener);
      _casa.removeListener('forward-response', this.forwardResponseListener);
   }
}

module.exports = exports = ChildCasaArea;
