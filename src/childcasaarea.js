var util = require('util');
var CasaArea = require('./casaarea');

function ChildCasaArea(_obj) {

   CasaArea.call(this, _obj);

   var that = this;

}

util.inherits(ChildCasaArea, CasaArea);

ChildCasaArea.prototype.setupCasaListeners = function(_casa) {
   var that = this;
   // TBD Add listeners and logic

   // BROADCASTING local broadcast (this casa's peer states and activators) already done by peer casa class
   // BROADCASTING Broadcast to area this casa is running in (not the child casa area);
   // BROADCASTING Broadcast to parent area (Uber casa) of the casa we are running in (not the the parent area of this child casa area);
   // BROADCASTING Broadcast to child areas (Uber casa) of the casa we are running in except source area (not the the parent area of this child casa area);

   _casa.on('state-active', function(_data) {
      console.log(that.name + ': Event received from child. Event name: active, state: ' + _data.sourceName);
   });

   _casa.on('state-inactive', function(_data) {
      console.log(that.name + ': Event received from child. Event name: inactive, state: ' + _data.sourceName);
   });

   // listen for activator changes from peer casas
   _casa.on('activator-active', function(_data) {
      console.log(that.name + ': Event received from child. Event name: active, activator: ' + _data.sourceName);
   });

   _casa.on('activator-inactive', function(_data) {
      console.log(that.name + ': Event received from child. Event name: inactive, activator: ' + _data.sourceName);
   });


   // FORWARDING If my casa is the target, peer casa class takes care of this
   // FORWARDING If my area is the target, find peer casa and forward
   // FORWARDING If my area is not the target, is the area a child area of mine? YES - forward to next hop for child. NO - forward to parent
}

module.exports = exports = ChildCasaArea;