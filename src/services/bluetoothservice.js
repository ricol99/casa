var util = require('util');
var Service = require('../service');
var BtPresence = require('bt-presence').btPresence

function BluetoothService(_config, _owner) {
   Service.call(this, _config, _owner);
   this.interval = _config.hasOwnProperty("interval") ? _config.interval : 15;

   this.deviceTypes = {
      "nearby": "btnearbydevice"
   };

   this.scanList = {};
   this.scanListLength = 0;
   this.btp = new BtPresence()
}

util.inherits(BluetoothService, Service);

// Called when current state required
BluetoothService.prototype.export = function(_exportObj) {
   Service.prototype.export.call(this, _exportObj);
};

// Called when current state required
BluetoothService.prototype.import = function(_importObj) {
   Service.prototype.import.call(this, _importObj);
};

BluetoothService.prototype.coldStart = function() {
   this.start();
   Service.prototype.coldStart.call(this);
};

BluetoothService.prototype.hotStart = function() {
   this.start();
   Service.prototype.hotStart.call(this);
};

BluetoothService.prototype.start = function() {
   this.btpPresentHandler = BluetoothService.prototype.devicePresentCb.bind(this);
   this.btpNotPresentHandler = BluetoothService.prototype.deviceNotPresentCb.bind(this);

   this.btp.setPingOptions({ count: 2, timeoutSecs: 5 });
   this.btp.setIntervalSeconds(this.interval)

   this.btp.on('present', this.btpPresentHandler);
   this.btp.on('not-present', this.btpNotPresentHandler);
};

BluetoothService.prototype.addDeviceToScan = function(_serviceNode, _macAddress, _interval) {
   console.log(this.uName + ": Requested to scan for bluetooth device with address " + _macAddress);
   this.setInterval(_interval);

   this.btp.addDevices([_macAddress]);
   this.scanList[_macAddress] = _serviceNode;
   this.scanListLength = this.scanListLength + 1;

   if (this.scanListLength === 1) {
      console.log(this.uName + ": Starting to scan for bluetooth devices");
      this.btp.start(true);
   }

   return true;
};

BluetoothService.prototype.removeDeviceFromScan = function(_serviceNode, _macAddress) {
   console.log(this.uName + ": Requested to stop scanning for bluetooth device with address " + _macAddress);

   this.btp.removeDevices([_macAddress]);
   delete this.scanList[_macAddress];
   this.scanListLength = this.scanListLength - 1;

   if (this.scanListLength === 0) {
      console.log(this.uName + ": Ceased scanning for bluetooth devices");
      this.btp.stop();
   }

   return true;
};

BluetoothService.prototype.setInterval = function(_interval) {

   if (_interval < this.interval) {
      this.interval = _interval;
      this.btp.setIntervalSeconds(this.interval)
   }
}

BluetoothService.prototype.devicePresentCb = function(_macAddress) {
   console.log(this.uName + ": Device present " + _macAddress);

   if (this.scanList.hasOwnProperty(_macAddress)) {
      this.scanList[_macAddress].deviceFound();
   }
};

BluetoothService.prototype.deviceNotPresentCb = function(_macAddress) {
   console.log(this.uName + ": Device not present " + _macAddress);

   if (this.scanList.hasOwnProperty(_macAddress)) {
      this.scanList[_macAddress].deviceLost();
   }
};

module.exports = exports = BluetoothService;
