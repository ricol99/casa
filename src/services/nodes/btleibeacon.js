var util = require('util');
var ServiceNode = require('./servicenode');

function BtleIBeacon(_config, _owner) {
   ServiceNode.call(this, _config, _owner);
   this.ensurePropertyExists("available", 'property', { initialValue: false, allSourcesRequiredForValidity: false }, this.config);
}

util.inherits(BtleIBeacon, ServiceNode);

BtleIBeacon.prototype.newSubscriptionAdded = function(_subscription) {
   console.log(this.uName + ": newSubscriptionAdded() serviceProperty=" + _subscription.serviceProperty + ", args = ", _subscription.args);
   this.uuid = _subscription.args.uuid.toUpperCase();
   this.major = _subscription.args.major;
   this.minor = _subscription.args.minor;
   this.match = { uuid: this.uuid };

   if (this.major) {
      this.match.major = this.major;
   }

   if (this.minor) {
      this.match.minor = this.minor;
   }

   this.start();
};

BtleIBeacon.prototype.start = function(_interval) {

   if (this.started) {
      return;
   }

   this.started = true;
   this.owner.addAdvertisementToScan(this, "iBeacon", this.match);
}

BtleIBeacon.prototype.stop = function() {

   if (this.started) {
      this.owner.removeAdvertisementToScan(this, "iBeacon", this.match);
      this.started = false;
   }
}

BtleIBeacon.prototype.advertisementFound = function() {
   this.alignPropertyValue("available", true);
};

BtleIBeacon.prototype.advertisementLost = function() {
   this.alignPropertyValue("available", false);
};

BtleIBeacon.prototype.processPropertyChanged = function(_transaction, _callback) {
   _callback(null, true);
};


module.exports = exports = BtleIBeacon;
