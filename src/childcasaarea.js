var util = require('util');
var CasaArea = require('./casaarea');
var CasaSystem = require('./casasystem');

function ChildCasaArea(_config) {

   // Resolve source and target
   this.casaSys = CasaSystem.mainInstance();

   CasaArea.call(this, _config);

   var that = this;

   this.broadcastListener = function(_message) {
      console.log(that.name + ': Event received from child. Event name: ' + _message.message +', source: ' + _message.data.sourceName);

      // Broadcast to all my siblings
      for(var prop in that.casaSys.childCasaAreas) {

         if(that.casaSys.childCasaAreas.hasOwnProperty(prop)){
            var childCasaArea = that.casaSys.childCasaAreas[prop];

            // Is the area a sibling?
            if (childCasaArea != that) {
               console.log(that.name + ': Broadcasting to child area ' + childCasaArea.name);
               childCasaArea.broadcastMessage(_message);
            }
         }
      }

      if (that.casaSys.peerCasaArea) {
         console.log(that.name + ': Broadcasting message from child to my peers');
         that.casaSys.peerCasaArea.broadcastMessage(_message);
      }

      if (that.casaSys.parentCasaArea) {
         console.log(that.name + ': Broadcasting to my parent');
         that.parentCasaArea.broadcastMessage(_message);
      }
   };

   this.forwardRequestListener = function(_data) {
      console.log(that.name + ': Forward event request from child. State: ' + _data.data.stateName);
   };

   this.forwardResponseListener = function(_data) {
      console.log(that.name + ': Forward event response from child. State: ' + _data.data.stateName);
   };
}

util.inherits(ChildCasaArea, CasaArea);

ChildCasaArea.prototype.setupCasaListeners = function(_casa) {
   var that = this;

   // BROADCASTING local broadcast (this casa's peer states and activators) already done by peer casa class
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
      _casa.removeListeners('broadcast-message', this.broadcastListener);
      _casa.removeListeners('forward-request', this.forwardRequestListener);
      _casa.removeListeners('forward-response', this.forwardResponseListener);
   }
}

module.exports = exports = ChildCasaArea;
