var util = require('util');
var CasaArea = require('./casaarea');

function ParentCasaArea(_config) {

   CasaArea.call(this, _config);

   var that = this;

   this.broadcastListener = function(_message) {
      console.log(that.uName + ': Event received from parent. Event name: ' + _message.message +', source: ' + _message.data.sourceName);

      // Broadcast to all children - peers already know
      for(var prop in that.casaSys.childCasaAreas) {

         if(that.casaSys.childCasaAreas.hasOwnProperty(prop)){
            console.log(that.uName + ': Broadcasting to child area ' + that.casaSys.childCasaAreas[prop].uName);
            that.casaSys.childCasaAreas[prop].broadcastMessage(_message);
         }
      }
   };

   this.forwardRequestListener = function(_data) {
      console.log(that.uName + ': Forward event request from parent. Source: ' + _data.data.sourceName);
   };

   this.forwardResponseListener = function(_data) {
      console.log(that.uName + ': Forward event response from parent. Source: ' + _data.data.sourceName);
   };


}

util.inherits(ParentCasaArea, CasaArea);

ParentCasaArea.prototype.buildCasaForwardingList = function() {
   var casaList = [];

   // My child
   casaList.push(this.casaSys.casa);

   // All my grand children
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

   // Any remotes my child is aware of
   for(var prop4 in this.casaSys.remoteCasas) {

      if ((this.casaSys.remoteCasas.hasOwnProperty(prop4)) && (this.casaSys.remoteCasas[prop4].loginAs == 'remote')) {
         casaList.push(this.casaSys.remoteCasas[prop4]);
      }
   }

   return casaList;
}

ParentCasaArea.prototype.setupCasaListeners = function(_casa) {
   var that = this;

   if (this.casaSys.isUberCasa()) {

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

ParentCasaArea.prototype.removeCasaListeners = function(_casa) {

   if (this.casaSys.isUberCasa()) {
      _casa.removeListener('broadcast-message', this.broadcastListener);
      _casa.removeListener('forward-request', this.forwardRequestListener);
      _casa.removeListener('forward-response', this.forwardResponseListener);
   }
}

module.exports = exports = ParentCasaArea;
