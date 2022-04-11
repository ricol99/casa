var util = require('util');
var ServiceNode = require('./servicenode');

function BtleDevice(_config, _owner) {
   ServiceNode.call(this, _config, _owner);
   this.ensurePropertyExists("available", 'property', { initialValue: false, allSourcesRequiredForValidity: false }, this.config);
}

util.inherits(BtleDevice, ServiceNode);

// Called when current state required
BtleDevice.prototype.export = function(_exportObj) {
   ServiceNode.prototype.export.call(this, _exportObj);
};

// Called when current state required
BtleDevice.prototype.import = function(_importObj) {
   ServiceNode.prototype.import.call(this, _importObj);
};

BtleDevice.prototype.coldStart = function() {
   ServiceNode.prototype.coldStart.call(this);
};

BtleDevice.prototype.hotStart = function() {
   ServiceNode.prototype.hotStart.call(this);
};

BtleDevice.prototype.newSubscriptionAdded = function(_subscription) {
   console.log(this.uName + ": newSubscriptionAdded() args = ", _subscription.args);
   this.macAddress = _subscription.args.macAddress.toLowerCase();
   this.start();
};

BtleDevice.prototype.start = function(_interval) {

   if (this.started) {
      return;
   }

   this.started = true;
   this.owner.addAdvertisementToScan(this, "address", this.macAddress);
}

BtleDevice.prototype.stop = function() {

   if (this.started) {
      this.owner.removeAdvertisementToScan(this, "address", this.macAddress);
      this.started = false;
   }
}

BtleDevice.prototype.advertisementFound = function() {
   this.alignPropertyValue("available", true);
};

BtleDevice.prototype.advertisementLost = function() {
   this.alignPropertyValue("available", false);
};

BtleDevice.prototype.processPropertyChanged = function(_transaction, _callback) {
   _callback(null, true);
};

module.exports = exports = BtleDevice;
