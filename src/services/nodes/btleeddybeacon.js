var util = require('util');
var ServiceNode = require('./servicenode');
var eddystoneBeacon = require('eddystone-beacon');

function BtleEddyBeacon(_config, _owner) {
   ServiceNode.call(this, _config, _owner);
   this.ensurePropertyExists("available", 'property', { initialValue: false, allSourcesRequiredForValidity: false }, this.config);
   this.advertise = false;
   this.scan = false;
   this.advertising = false;
   this.scanning = false;
}

util.inherits(BtleEddyBeacon, ServiceNode);

BtleEddyBeacon.prototype.newSubscriptionAdded = function(_subscription) {
   console.log(this.uName + ": newSubscriptionAdded() args = ", _subscription.args);

   if (_subscription.args.hasOwnProperty("advertisement")) {
      this.advertise = true;
      this.advertisement = {};

      if (_subscription.args.advertisement.hasOwnProperty("namespace")) {
         this.advertisement.namespace = _subscription.args.advertisement.namespace.toUpperCase()
         this.advertisement.instance = _subscription.args.advertisement.instance.toUpperCase()
      }
      else {
         this.advertisement.url = _subscription.args.advertisement.url;
      }
   }

   if (_subscription.args.namespace) {
      this.scan = true;
      this.namespace = _subscription.args.namespace.toUpperCase();
      this.instance = _subscription.args.instance.toUpperCase();
      this.match = { namespace: this.namespace, instance: this.instance };
      this.field = "eddystoneUid";
   }
   else if (_subscription.args.macAddress) {
      this.scan = true;
      this.macAddress = _subscription.args.macAddress.toLowerCase();
      this.match = this.macAddress;
      this.field = "address";
   }

   if (this.scan) {
      this.startScanning();
   }

   if (this.advertise) {
      this.startAdvertising();
   }
};

BtleEddyBeacon.prototype.startScanning = function(_interval) {

   if (this.scanning) {
      return;
   }

   this.scanning = true;
   this.owner.addAdvertisementToScan(this, this.field, this.match);
};

BtleEddyBeacon.prototype.startAdvertising = function(_interval) {

   if (this.advertising) {
      return;
   }

   this.advertising = true;

   if (this.advertisement.namespace) {
      eddystoneBeacon.advertiseUid(this.advertisement.namespace, this.advertisement.instance, {  name: 'Casa', tlmCount: 2, tlmPeriod: 10 });
   }
   else {
      eddystoneBeacon.advertiseUrl(this.advertisement.url, {  name: 'Casa', tlmCount: 2, tlmPeriod: 10 });
   }
};

BtleEddyBeacon.prototype.stopScanning = function() {

   if (this.scanning) {
      this.owner.removeAdvertisementToScan(this, this.field, this.match);
      this.scanning = false;
   }
}

BtleEddyBeacon.prototype.stopAdvertising = function() {

   if (this.advertising) {
      eddystoneBeacon.stop();
      this.advertising = false;
   }
}

BtleEddyBeacon.prototype.stop = function() {
   this.stopScanning();
   this.stopAdvertising();
};

BtleEddyBeacon.prototype.advertisementFound = function() {
   this.alignPropertyValue("available", true);
};

BtleEddyBeacon.prototype.advertisementLost = function() {
   this.alignPropertyValue("available", false);
};

BtleEddyBeacon.prototype.processPropertyChanged = function(_transaction, _callback) {
   _callback(null, true);
};

module.exports = exports = BtleEddyBeacon;
