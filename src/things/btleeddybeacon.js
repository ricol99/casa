var util = require('util');
var Thing = require('../thing');

function BtleEddyBeacon(_config, _parent) {
   Thing.call(this, _config, _parent);
   this.thingType = "btle-eddy-beacon";
   this.displayName = _config.displayName;
   this.namespace = _config.hasOwnProperty("namespace") ? _config.namespace : null;
   this.instance = _config.hasOwnProperty("instance") ? _config.instance : null;
   this.macAddress = _config.hasOwnProperty("macAddress") ? _config.macAddress.toLowerCase() : null;
   this.advertisement = _config.hasOwnProperty("advertisement") ? _config.advertisement : null;
   this.serviceName = (_config.hasOwnProperty("serviceName")) ? _config.serviceName :  this.gang.casa.findServiceName("btleservice");

   if (!this.serviceName) {
      console.error(this.uName + ": ***** Bluetooth LE service not found! *************");
      process.exit();
   }

   var args = {};
   var id;

   if (this.namespace) {
      args.namespace = this.namespace;
      args.instance = this.instance;
      id = this.namespace + "-" + this.instance;
   }
   else {
      args.macAddress = this.macAddress;
      id = this.macAddress.replace(/:/g, "-");
   }

   if (this.advertisement) {
      args.advertisement = this.advertisement;
   }

   this.ensurePropertyExists('available', 'serviceproperty', { id: id, serviceType: "eddybeacon", serviceName: this.serviceName, sync: "read", serviceArgs: args }, _config);
}

util.inherits(BtleEddyBeacon, Thing);

// Called when current state required
BtleEddyBeacon.prototype.export = function(_exportObj) {
   Thing.prototype.export.call(this, _exportObj);
};

// Called when current state required
BtleEddyBeacon.prototype.import = function(_importObj) {
   Thing.prototype.import.call(this, _importObj);
};

BtleEddyBeacon.prototype.coldStart = function() {
   Thing.prototype.coldStart.call(this);
};

BtleEddyBeacon.prototype.hotStart = function() {
   Thing.prototype.hotStart.call(this);
};

module.exports = exports = BtleEddyBeacon;
