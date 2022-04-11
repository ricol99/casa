var util = require('util');
var HueLightGroup = require('./huelightgroup');

function HueRoom(_config, _parent) {
   this.groupType = "Room";
   
   if (_config.hasOwnProperty('hueRoomName')) {
      _config.hueGroupName = _config.hueRoomName;
   }

   HueLightGroup.call(this, _config, _parent);
   this.thingType = "hue-room";
}

util.inherits(HueRoom, HueLightGroup);

// Called when current state required
HueRoom.prototype.export = function(_exportObj) {
   HueLightGroup.prototype.export.call(this, _exportObj);
};

// Called when current state required
HueRoom.prototype.import = function(_importObj) {
   HueLightGroup.prototype.import.call(this, _importObj);
};

HueRoom.prototype.coldStart = function() { 
   HueLightGroup.prototype.coldStart.call(this);
};

HueRoom.prototype.hotStart = function() {
   HueLightGroup.prototype.hotStart.call(this);
};

module.exports = exports = HueRoom;
