var util = require('util');
var Thing = require('../thing');

function BtleIBeacon(_config, _parent) {
   Thing.call(this, _config, _parent);
   this.thingType = "btle-ibeacon";
   this.displayName = _config.displayName;
   this.uuid = _config.uuid.toUpperCase();
   this.major = _config.hasOwnProperty("major") ? _config.major : null;
   this.minor = _config.hasOwnProperty("minor") ? _config.minor : null;
   this.serviceName = (_config.hasOwnProperty("serviceName")) ? _config.serviceName :  this.gang.casa.findServiceName("btleservice");

   if (!this.serviceName) {
      console.error(this.uName + ": ***** Bluetooth LE service not found! *************");
      process.exit();
   }

   this.ensurePropertyExists('available', 'serviceproperty', { id: this.uuid, serviceType: "ibeacon", serviceName: this.serviceName, sync: "read", serviceArgs: { uuid: this.uuid, major: this.major, minor: this.minor } }, _config);
}

util.inherits(BtleIBeacon, Thing);

module.exports = exports = BtleIBeacon;
