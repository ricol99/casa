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

// Called when current state required
BtleNearbyDevice.prototype.export = function(_exportObj) {
   Thing.prototype.export.call(this, _exportObj);
};

// Called when current state required
BtleNearbyDevice.prototype.import = function(_importObj) {
   Thing.prototype.import.call(this, _importObj);
};

BtleNearbyDevice.prototype.coldStart = function() {
   Thing.prototype.coldStart.call(this);
};

BtleNearbyDevice.prototype.hotStart = function() {
   Thing.prototype.hotStart.call(this);
};

module.exports = exports = BtleNearbyDevice;
