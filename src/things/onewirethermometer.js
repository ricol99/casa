var util = require('util');
var Thing = require('../thing');
var Gang = require('../gang');

function OneWireThermometer(_config, _parent) {
   this.gang = Gang.mainInstance();

   if (_config.hasOwnProperty("service")) {
      this.oneWireServiceName = _config.service;
   }
   else {
      var service =  this.gang.casa.findService("onewireservice");

      if (!service) {
         console.error(this.uName + ": ***** OneWire service not found! *************");
         process.exit();
      }

      this.oneWireServiceName = service.uName;
   }

   this.pollDuration = _config.hasOwnProperty("pollDuration") ? _config.pollDuration : 60000;

   _config.mirrorSource = this.oneWireServiceName+":onewireservicethermometer:"+_config.deviceId;
   _config.mirrorSourceSubscription = { pollDuration: this.pollDuration };

   Thing.call(this, _config, _parent);
   this.ensurePropertyExists('temperature', 'property', { initialValue: 0 }, _config);
   this.thingType = "onewire-thermometer";
   this.deviceId = _config.deviceId;
}

util.inherits(OneWireThermometer, Thing);

OneWireThermometer.prototype.propertyAboutToChange = function(_propName, _propValue, _data) {
};

module.exports = exports = OneWireThermometer;
