var util = require('util');
var Thing = require('../thing');

function OneWireThermometer(_config, _parent) {
   Thing.call(this, _config, _parent);
   this.serviceName = (_config.hasOwnProperty("serviceName")) ? _config.serviceName :  this.gang.casa.findServiceName("onewireservice");

   if (!this.serviceName) {
      console.error(this.uName + ": ***** Hue service not found! *************");
      process.exit();
   }

   this.pollDuration = _config.hasOwnProperty("pollDuration") ? _config.pollDuration : 60000;

   this.deviceId = _config.deviceId;
   this.ensurePropertyExists('temperature', 'onewireproperty', { initialValue: 0, deviceId: this.deviceId, deviceType: "28", serviceProperty: "temperature", serviceName: this.serviceName, sync: "read", serviceArgs: { pollDuration: this.pollDuration} }, _config);
   this.thingType = "onewire-thermometer";
}

util.inherits(OneWireThermometer, Thing);

// Called when current state required
OneWireThermometer.prototype.export = function(_exportObj) {
   Thing.prototype.export.call(this, _exportObj);
};

// Called when current state required
OneWireThermometer.prototype.import = function(_importObj) {
   Thing.prototype.import.call(this, _importObj);
};

OneWireThermometer.prototype.coldStart = function() { 
   Thing.prototype.coldStart.call(this);
};

OneWireThermometer.prototype.hotStart = function() {
   Thing.prototype.hotStart.call(this);
};

module.exports = exports = OneWireThermometer;
