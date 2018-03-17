var util = require('util');
var HueLightGroup = require('./huelightgroup');

function HueRoom(_config) {
   this.groupType = "Room";
   
   if (_config.hasOwnProperty('hueRoomName')) {
      _config.hueGroupName = _config.hueRoomName;
   }

   HueLightGroup.call(this, _config);
   this.thingType = "hue-room";
}

util.inherits(HueRoom, HueLightGroup);

module.exports = exports = HueRoom;
