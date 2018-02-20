var util = require('util');
var CasaArea = require('./casaarea');

function ParentCasaArea(_config) {
   CasaArea.call(this, _config);

   this.broadcastListener = ParentCasaArea.prototype.broadcastCb.bind(this);
   this.forwardRequestListener = ParentCasaArea.prototype.forwardRequestCb.bind(this);
   this.forwardResponseListener = ParentCasaArea.prototype.forwardResponseCb.bind(this);
}

util.inherits(ParentCasaArea, CasaArea);

ParentCasaArea.prototype.broadcastCb = function(_message) {
   console.log(this.uName + ': Event received from parent. Event name: ' + _message.message +', source: ' + _message.data.sourceName);

   // Broadcast to all children - peers already know
   for(var prop in this.casaSys.childCasaAreas) {

      if(this.casaSys.childCasaAreas.hasOwnProperty(prop)){
         console.log(this.uName + ': Broadcasting to child area ' + this.casaSys.childCasaAreas[prop].uName);
         this.casaSys.childCasaAreas[prop].broadcastMessage(_message);
      }
   }
};

ParentCasaArea.prototype.forwardRequestCb = function(_data) {
   console.log(this.uName + ': Forward event request from parent. Source: ' + _data.data.sourceName);
};

ParentCasaArea.prototype.forwardResponseCb = function(_data) {
   console.log(this.uName + ': Forward event response from parent. Source: ' + _data.data.sourceName);
};

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

      if ((this.casaSys.remoteCasas.hasOwnProperty(prop4)) && this.casaSys.remoteCasas[prop4] && (this.casaSys.remoteCasas[prop4].loginAs == 'remote')) {
         casaList.push(this.casaSys.remoteCasas[prop4]);
      }
   }

   return casaList;
}

ParentCasaArea.prototype.setupCasaListeners = function(_casa) {

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
