var util = require('util');
var CasaArea = require('./casaarea');
var CasaSystem = require('./casasystem');

function ChildCasaArea(_config) {

   // Resolve source and target
   this.casaSys = CasaSystem.mainInstance();

   CasaArea.call(this, _config);

   var that = this;

}

util.inherits(ChildCasaArea, CasaArea);

ChildCasaArea.prototype.setupCasaListeners = function(_casa) {
   var that = this;

   // BROADCASTING local broadcast (this casa's peer states and activators) already done by peer casa class
   // BROADCASTING Broadcast to area this casa is running in (not the child casa area);
   // BROADCASTING Broadcast to parent area (Uber casa) of the casa we are running in (not the the parent area of this child casa area);
   // BROADCASTING Broadcast to child areas (Uber casa) of the casa we are running in except source area (not the the parent area of this child casa area);

   if (this.casaSys.isUberCasa()) {

      _casa.on('broadcast-message', function(_message) {
         console.log(that.name + ': Event received from child. Event name: ' + _message.message +', source: ' + _message.data.sourceName);

         that.casaSys.areas.forEach(function(_area) {
            console.log(that.name + ': Possible sibling child area ' + _area.name);

            // Is the area a sibling?
            if ((_area != that) && (_area.parentArea == that.parentArea)) {
               console.log(that.name + ': Broadcasting to child area ' + _area.name);
               _area.broadcastMessage(_message);
            }
         });

         if (that.parentArea) {
            console.log(that.name + ': Broadcasting to my parent area ' + that.parentArea.name);
            that.parentArea.broadcastMessage(_message);

            if (that.parentArea.parentArea) {
               console.log(that.name + ': Broadcasting to my parent\'s parent area ' + that.parentArea.parentArea);
               that.parentArea.parentArea.broadcastMessage(_message);
            }
         }
      });

      // TBD
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

module.exports = exports = ChildCasaArea;
