var util = require('util');
var CasaArea = require('./casaarea');

function ParentCasaArea(_config) {

   CasaArea.call(this, _config);

   var that = this;

}

util.inherits(ParentCasaArea, CasaArea);

ParentCasaArea.prototype.setupCasaListeners = function(_casa) {
   // TBD Add listeners and logic

   // BROADCASTING local broadcast (this casa's peer states and activators) already done by peer casa class
   // BROADCASTING Broadcast to area this casa is running in (not the parent casa area);
   // BROADCASTING Broadcast to all child areas (Uber casa) of the casa we are running (not the child of the parent casa area!);

   // FORWARDING If my casa is the target, peer casa class takes care of this
   // FORWARDING If my area is the target, find peer casa and forward
   // FORWARDING If my area is not the target, is the area a child area of mine? YES - forward to next hop for child. NO - forward to parent
}

module.exports = exports = ParentCasaArea;
