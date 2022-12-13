var util = require('util');
var Service = require('../service');
const { Client } = require('tplink-smarthome-api');

function KasaService(_config, _owner) {
   _config.queueQuant = 150;
   _config.deviceTypes = { "plug": "kasaserviceplug" };

   Service.call(this, _config, _owner);

   this.devicesAvailable = {};
}

util.inherits(KasaService, Service);

// Called when current state required
KasaService.prototype.export = function(_exportObj) {
   Service.prototype.export.call(this, _exportObj);
};

// Called when current state required
KasaService.prototype.import = function(_importObj) {
   Service.prototype.import.call(this, _importObj);
};

KasaService.prototype.coldStart = function() {
   this.start();
   Service.prototype.coldStart.call(this);
};

KasaService.prototype.hotStart = function() {
   this.start();
   Service.prototype.hotStart.call(this);
};

KasaService.prototype.start = function() {
   this.client = new Client();

   this.client.startDiscovery().on('device-new', (_device) => {

      _device.getSysInfo().then( (_info) => {
         this.devicesAvailable[_device.host+":"+_device.port] = { device: _device, info: util.copy(_info) };

         if (_info.hasOwnProperty("alias") && (_info.alias.length > 0)) {
            this.devicesAvailable[_info.alias] = { device: _device, info: util.copy(_info) };
         }
      });
   });
};

KasaService.prototype.setPlugState = function(_deviceId, _config, _callback) {
   var serviceNode = this.findOrCreateNode("plug", _deviceId);
   serviceNode.setState(_config, _callback);
};

KasaService.prototype.turnPlugOn = function(_deviceId, _callback) {
   var serviceNode = this.findOrCreateNode("plug", _deviceId);
   serviceNode.setState({ power: true }, _callback);
};

KasaService.prototype.turnPlugOff = function(_deviceId, _callback) {
   var serviceNode = this.findOrCreateNode("plug", _deviceId);
   serviceNode.setState({ power: false }, _callback);
};

KasaService.prototype.getPlugState = function(_deviceId, _callback) {
   var serviceNode = this.findOrCreateNode("plug", _deviceId);
   serviceNode.getState(_callback);
};

// Override this to indicate if a transaction is ready to come off the queue
// @return true - transaction successfully processed
//         false - transaction has not been processed, please requeue if possible
KasaService.prototype.transactionReadyForProcessing = function(_transaction) {
   return true;
};

module.exports = exports = KasaService;
