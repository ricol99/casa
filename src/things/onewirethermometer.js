var util = require('util');
var Thing = require('../thing');
var Gang = require('../gang');

function OneWireThermometer(_config, _parent) {
   this.gang = Gang.mainInstance();
   this.service = (_config.hasOwnProperty("service")) ? _config.service : "onewireservice";
   this.oneWireService =  this.gang.casa.findService(this.service);
   this.pollDuration = _config.hasOwnProperty("pollDuration") ? _config.pollDuration : 60000;

   if (!this.oneWireService) {
      console.error(this.uName + ": ***** OneWire service not found! *************");
      process.exit();
   }

   _config.mirrorSource = this.oneWireService.fullName+":onewireservicethermometer:"+_config.deviceId;
   _config.mirrorSourceSubscription = { pollDuration: this.pollDuration };

   Thing.call(this, _config, _parent);
   this.thingType = "onewire-thermometer";
   this.deviceId = _config.deviceId;
}

util.inherits(OneWireThermometer, Thing);

OneWireThermometer.prototype.propertyAboutToChange = function(_propName, _propValue, _data) {
};

module.exports = exports = OneWireThermometer;