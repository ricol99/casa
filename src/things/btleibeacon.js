var util = require('util');
var Thing = require('../thing');

function BtleIBeacon(_config, _parent) {
   Thing.call(this, _config, _parent);
   this.thingType = "btle-ibeacon";
   this.displayName = _config.displayName;
   this.uid = _config.uid.toLowerCase();
   this.major = _confighasOwnProperty("major") ? _config.major : null;
   this.minor = _confighasOwnProperty("minor") ? _config.minor : null;
   this.serviceName = (_config.hasOwnProperty("serviceName")) ? _config.serviceName :  this.gang.casa.findServiceName("btleservice");

   if (!this.serviceName) {
      console.error(this.uName + ": ***** Bluetooth LE service not found! *************");
      process.exit();
   }

   this.ensurePropertyExists('available', 'serviceproperty', { id: this.uid, serviceType: "ibeacon", serviceName: this.serviceName, sync: "read", serviceArgs: { uid: this.uid, major: this.major, minor: this.minor } }, _config);
}

util.inherits(BtleIBeacon, Thing);

module.exports = exports = BtleIBeacon;
