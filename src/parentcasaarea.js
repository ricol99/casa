var util = require('util');
var CasaArea = require('./casaarea');

function ParentCasaArea(_config) {

   CasaArea.call(this, _config);

   var that = this;

}

util.inherits(ParentCasaArea, CasaArea);

ParentCasaArea.prototype.setupCasaListeners = function(_casa) {
   var that = this;
   // TBD Add listeners and logic

   // BROADCASTING local broadcast (this casa's peer states and activators) already done by peer casa class
   // BROADCASTING Broadcast to area this casa is running in (not the child casa area);
   // BROADCASTING Broadcast to parent area (Uber casa) of the casa we are running in (not the the parent area of this child casa area);
   // BROADCASTING Broadcast to child areas (Uber casa) of the casa we are running in except source area (not the the parent area of this child casa area);

   if (this.casaSys.isUberCasa()) {

      _casa.on('broadcast-message', function(_message) {
         console.log(that.name + ': Event received from parent. Event name: ' + _message.message +', source: ' + _message.data.sourceName);

         // Broadcast to all children - peers already know
         that.casaSys.childCasaAreas.forEach(function(_area) {
            _area.broadcastMessage(_message);
         });
      });

      // FORWARDING If my casa is the target, peer casa class takes care of this
      // FORWARDING If my area is the target, find peer casa and forward
      // FORWARDING If my area is not the target, is the area a child area of mine? YES - forward to next hop for child. NO - forward to parent

      _casa.on('forward-request', function(_data) {
         console.log(that.name + ': Forward event request from child. State: ' + _data.data.stateName);
      });

      _casa.on('forward-response', function(_data) {
         console.log(that.name + ': Forward event response from child. State: ' + _data.data.stateName);
      });
   }
}

module.exports = exports = ParentCasaArea;
