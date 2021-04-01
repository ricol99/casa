var util = require('util');
var Thing = require('../thing');

function BtNearbyDevice(_config, _parent) {
   Thing.call(this, _config, _parent);
   this.thingType = "bt-nearby-device";
   this.displayName = _config.displayName;
   this.macAddress = _config.macAddress.toLowerCase();
   this.macId = this.macAddress.replace(/:/g, "-");
   this.interval = (_config.hasOwnProperty("interval")) ? _config.interval : 10000;
   this.serviceName = (_config.hasOwnProperty("serviceName")) ? _config.serviceName :  this.gang.casa.findServiceName("bluetoothservice");

   if (!this.serviceName) {
      console.error(this.uName + ": ***** Bluetooth service not found! *************");
      process.exit();
   }

   this.ensurePropertyExists('available', 'serviceproperty', { id: this.macId, serviceType: "nearby", serviceName: this.serviceName, sync: "read", serviceArgs: { macAddress: this.macAddress } }, _config);
   this.ensurePropertyExists('interval', 'serviceproperty', { id: this.macId, initialValue: this.interval, serviceType: "nearby", serviceName: this.serviceName, sync: "write", serviceArgs: { macAddress: this.macAddress } }, _config);
}

util.inherits(BtNearbyDevice, Thing);

module.exports = exports = BtNearbyDevice;
