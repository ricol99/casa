var util = require('util');
var Service = require('../service');
const BeaconScanner = require('node-beacon-scanner');
 
function BtleService(_config, _owner) {
   Service.call(this, _config, _owner);
   this.devicePresenceTimeout = _config.hasOwnProperty("devicePresenceTimeout") ? _config.devicePresenceTimeout : 5;

   this.deviceTypes = {
      "nearby": "btlenearbydevice"
   };

   this.scanList = {};
   this.scanListLength = 0;
   this.presentDevices = {};
   this.scanner = new BeaconScanner();
}

util.inherits(BtleService, Service);

function PresentDevice(_owner, _address) {
   this.owner = _owner;
   this.address = _address;

   this.timeout = setTimeout( () => {
     this.owner.deviceNotPresentCb(this.address);
   }, this.owner.devicePresenceTimeout * 1000);
}

PresentDevice.prototype.clearTimeout = function() {
   clearTimeout(this.timeout);
};

PresentDevice.prototype.resetTimeout = function() {
   clearTimeout(this.timeout);

   this.timeout = setTimeout( () => {
     this.owner.deviceNotPresentCb(this.address);
   }, this.owner.devicePresenceTimeout * 1000);
};

BtleService.prototype.coldStart = function() {

   this.scanner.onadvertisement = (_advert) => {

      if (this.scanList.hasOwnProperty(_advert.address)) {

         if (this.presentDevices.hasOwnProperty(_advert.address)) {
            this.presentDevices[_advert.address].resetTimeout();
         }
         else {
            this.devicePresentCb(_advert.address);
         }
      }
    };
};

BtleService.prototype.addDeviceToScan = function(_serviceNode, _macAddress, _interval) {
   console.log(this.uName + ": Requested to scan for bluetooth device with address " + _macAddress);

   this.scanList[_macAddress] = _serviceNode;
   this.scanListLength = this.scanListLength + 1;

   if (this.scanListLength === 1) {
 
      // Start scanning
      this.scanner.startScan().then(() => {
         console.log(this.uName + ": Starting to scan for bluetooth LE devices");
      }).catch((_error) => {
        console.error(this.uName + ": An error has occurred while trying to start scanning: " + _error);
      });
   }

   return true;
};

BtleService.prototype.removeDeviceFromScan = function(_serviceNode, _macAddress) {
   console.log(this.uName + ": Requested to stop scanning for bluetooth device with address " + _macAddress);

   this.btp.removeDevices([_macAddress]);
   delete this.scanList[_macAddress];
   this.scanListLength = this.scanListLength - 1;

   if (this.scanListLength === 0) {

      // Start scanning
      this.scanner.stopScan().then(() => {
         console.log(this.uName + ": Stopped scanning for bluetooth LE devices");
      }).catch((_error) => {
        console.error(this.uName + ": An error has occurred while trying to stop scanning: " + _error);
      });
   }

   return true;
};

BtleService.prototype.devicePresentCb = function(_macAddress) {
   console.log(this.uName + ": Device present " + _macAddress);
   this.presentDevices[_macAddress] = new PresentDevice(this, _macAddress);
   console.log(this.presentDevices);

   if (this.scanList.hasOwnProperty(_macAddress)) {
      this.scanList[_macAddress].deviceFound();
   }
};

BtleService.prototype.deviceNotPresentCb = function(_macAddress) {
   console.log(this.uName + ": Device not present " + _macAddress);

   if (this.scanList.hasOwnProperty(_macAddress)) {

      if (this.presentDevices.hasOwnProperty(_macAddress)) {
         this.presentDevices[_macAddress].clearTimeout();
         delete this.presentDevices[_macAddress];
      }
      this.scanList[_macAddress].deviceLost();
   }
};

module.exports = exports = BtleService;
