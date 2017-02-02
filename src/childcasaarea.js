var util = require('util');
var CasaArea = require('./casaarea');
var CasaSystem = require('./casasystem');

function ChildCasaArea(_config) {

   // Resolve source and target
   this.casaSys = CasaSystem.mainInstance();

   CasaArea.call(this, _config);

   var that = this;

   this.broadcastListener = function(_message) {
      console.log(that.uName + ': Event received from child. Event name: ' + _message.message +', source: ' + _message.data.sourceName);

      // Broadcast to all my siblings
      for(var prop in that.casaSys.childCasaAreas) {

         if(that.casaSys.childCasaAreas.hasOwnProperty(prop)){
            var childCasaArea = that.casaSys.childCasaAreas[prop];

            // Is the area a sibling?
            if (childCasaArea != that) {
               console.log(that.uName + ': Broadcasting to child area ' + childCasaArea.uName);
               childCasaArea.broadcastMessage(_message);
            }
         }
      }

      if (that.casaSys.peerCasaArea) {
         that.casaSys.peerCasaArea.broadcastMessage(_message);
      }

      if (that.casaSys.parentCasaArea) {
         that.parentCasaArea.broadcastMessage(_message);
      }
   };

   this.forwardRequestListener = function(_data) {
      console.log(that.uName + ': Forward event request from child. Source: ' + _data.data.sourceName);
   };

   this.forwardResponseListener = function(_data) {
      console.log(that.uName + ': Forward event response from child. Source: ' + _data.data.sourceName);
   };
}

util.inherits(ChildCasaArea, CasaArea);

ChildCasaArea.prototype.buildCasaForwardingList = function() {
   var casaList = [];

   // My parent
   casaList.push(this.casaSys.casa);

   // All my siblings
   for (var prop in this.casaSys.childCasaAreas) {

      if (this.casaSys.childCasaAreas.hasOwnProperty(prop)){
         var childCasaArea = this.casaSys.childCasaAreas[prop];

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

   if (this.casaSys.peerCasaArea) {
      // All my uncles and aunties
      for(var prop3 in this.casaSys.peerCasaArea.casas) {

         if (this.casaSys.peerCasaArea.casas.hasOwnProperty(prop3)){
            casaList.push(this.casaSys.peerCasaArea.casas[prop3]);
         }
      }
   }

   if (this.casaSys.parentCasaArea) {
      // My grand parent
      casaList.push(this.casaSys.parentCasaArea.casas[0]);
   }

   // Any remotes my parent is aware of
   for(var prop4 in this.casaSys.remoteCasas) {

      if ((this.casaSys.remoteCasas.hasOwnProperty(prop4)) && (this.casaSys.remoteCasas[prop4].loginAs == 'remote')) {
         casaList.push(this.casaSys.remoteCasas[prop4]);
      }
   }

   return casaList;
}

ChildCasaArea.prototype.setupCasaListeners = function(_casa) {
   var that = this;

   // BROADCASTING local broadcast (this casa's peer sources) already done by peer casa class
   // BROADCASTING Broadcast to area this casa is running in (not the child casa area);
   // BROADCASTING Broadcast to parent area (Uber casa) of the casa we are running in (not the the parent area of this child casa area);
   // BROADCASTING Broadcast to child areas (Uber casa) of the casa we are running in except source area (not the the parent area of this child casa area);

   if (this.casaSys.isUberCasa()) {

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

   if (this.casaSys.isUberCasa()) {
      _casa.removeListener('broadcast-message', this.broadcastListener);
      _casa.removeListener('forward-request', this.forwardRequestListener);
      _casa.removeListener('forward-response', this.forwardResponseListener);
   }
}

module.exports = exports = ChildCasaArea;
