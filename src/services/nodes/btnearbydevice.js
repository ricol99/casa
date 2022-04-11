var util = require('util');
var ServiceNode = require('./servicenode');

function BtNearbyDevice(_config, _owner) {
   ServiceNode.call(this, _config, _owner);
   this.ensurePropertyExists("available", 'property', { initialValue: false, allSourcesRequiredForValidity: false }, this.config);
   this.ensurePropertyExists("interval", 'property', { initialValue: 10, allSourcesRequiredForValidity: false }, this.config);
}

util.inherits(BtNearbyDevice, ServiceNode);

// Called when current state required
BtNearbyDevice.prototype.export = function(_exportObj) {
   ServiceNode.prototype.export.call(this, _exportObj);
};

// Called when current state required
BtNearbyDevice.prototype.import = function(_importObj) {
   ServiceNode.prototype.import.call(this, _importObj);
};

BtNearbyDevice.prototype.coldStart = function() {
   ServiceNode.prototype.coldStart.call(this);
};

BtNearbyDevice.prototype.hotStart = function() {
   ServiceNode.prototype.hotStart.call(this);
};

BtNearbyDevice.prototype.newSubscriptionAdded = function(_subscription) {
   console.log(this.uName + ": newSubscriptionAdded() args = ", _subscription.args);
   this.macAddress = _subscription.args.macAddress.toLowerCase();

   if (_subscription.interval < this.getProperty("interval")) {
      this.alignPropertyValue('interval', _subscription.interval);
      this.restart(_subscription.interval);
   }

   this.start();
};

BtNearbyDevice.prototype.start = function(_interval) {

   if (this.started) {
      return;
   }

   this.started = true;
   this.owner.addDeviceToScan(this, this.macAddress, _interval ? _interval : this.getProperty("interval"));
}

BtNearbyDevice.prototype.stop = function() {

   if (this.started) {
      this.owner.removeDeviceFromScan(this, this.macAddress);
      this.started = false;
   }
}

BtNearbyDevice.prototype.restart = function(_interval) {
   this.stop();
   this.start(_interval);
};

BtNearbyDevice.prototype.deviceFound = function() {
   this.alignPropertyValue("available", true);
};

BtNearbyDevice.prototype.deviceLost = function() {
   this.alignPropertyValue("available", false);
};

BtNearbyDevice.prototype.processPropertyChanged = function(_transaction, _callback) {

   if (_transaction.properties && _transaction.properties.hasOwnProperty("interval")) {
      this.restart(_transaction.properties.interval);
   }

   _callback(null, true);
};


module.exports = exports = BtNearbyDevice;
