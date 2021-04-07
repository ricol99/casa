var util = require('util');
var Thing = require('../thing');

function BtleNearbyDevice(_config, _parent) {
   Thing.call(this, _config, _parent);
   this.thingType = "bt-nearby-device";
   this.displayName = _config.displayName;
   this.macAddress = _config.macAddress.toLowerCase();
   this.macId = this.macAddress.replace(/:/g, "-");
   this.serviceName = (_config.hasOwnProperty("serviceName")) ? _config.serviceName :  this.gang.casa.findServiceName("btleservice");

   if (!this.serviceName) {
      console.error(this.uName + ": ***** Bluetooth LE service not found! *************");
      process.exit();
   }

   this.ensurePropertyExists('available', 'serviceproperty', { id: this.macId, serviceType: "nearby", serviceName: this.serviceName, sync: "read", serviceArgs: { macAddress: this.macAddress } }, _config);
}

util.inherits(BtleNearbyDevice, Thing);

module.exports = exports = BtleNearbyDevice;
