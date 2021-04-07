var util = require('util');
var ServiceNode = require('./servicenode');

function BtleNearbyDevice(_config, _owner) {
   ServiceNode.call(this, _config, _owner);
   this.ensurePropertyExists("available", 'property', { initialValue: false, allSourcesRequiredForValidity: false }, this.config);
}

util.inherits(BtleNearbyDevice, ServiceNode);

BtleNearbyDevice.prototype.newSubscriptionAdded = function(_subscription) {
   console.log(this.uName + ": newSubscriptionAdded() args = ", _subscription.args);
   this.macAddress = _subscription.args.macAddress.toLowerCase();
   this.start();
};

BtleNearbyDevice.prototype.start = function(_interval) {

   if (this.started) {
      return;
   }

   this.started = true;
   this.owner.addDeviceToScan(this, this.macAddress);
}

BtleNearbyDevice.prototype.stop = function() {

   if (this.started) {
      this.owner.removeDeviceFromScan(this, this.macAddress);
      this.started = false;
   }
}

BtleNearbyDevice.prototype.deviceFound = function() {
   this.alignPropertyValue("available", true);
};

BtleNearbyDevice.prototype.deviceLost = function() {
   this.alignPropertyValue("available", false);
};

BtleNearbyDevice.prototype.processPropertyChanged = function(_transaction, _callback) {
   _callback(null, true);
};


module.exports = exports = BtleNearbyDevice;
