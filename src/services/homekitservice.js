var util = require('util');
var Service = require('../service');
var storage = require('node-persist');
const HAP = require('hap-nodejs');
HAP.init();

var Bridge = HAP.Bridge;
var Accessory = HAP.Accessory;
var Characteristic = HAP.Characteristic;
var uuid = HAP.uuid;

storage.initSync();

function HomekitService(_config, _owner) {
   Service.call(this, _config, _owner);

   this.port = this.casa.allocatePort(this.uName);

   this.displayName = _config.displayName;
   this.pincode = _config.pincode;
   this.username = _config.username;
   this.manufacturer = (_config.manufacturer == undefined) ? "Casa" : _config.manufacturer;
   this.model = (_config.model == undefined) ? "v1.0" : _config.model;
   this.serialNumber = (_config.serialNumber == undefined) ? "XXXXXXX" : _config.serialNumber;

   this.hkUUID = uuid.generate('hap-nodejs:accessories:' + this.name);
}

util.inherits(HomekitService, Service);

// Called when current state required
HomekitService.prototype.export = function(_exportObj) {
   Service.prototype.export.call(this, _exportObj);
};

// Called when current state required
HomekitService.prototype.import = function(_importObj) {
   Service.prototype.import.call(this, _importObj);
};

HomekitService.prototype.coldStart = function() {
   this.start();
   Service.prototype.coldStart.call(this);
};

HomekitService.prototype.hotStart = function() {
   this.start();
   Service.prototype.hotStart.call(this);
};

HomekitService.prototype.start = function() {
   // Start by creating our Bridge which will host all loaded Accessories
   this.bridge = new Bridge('Casa Homekit Bridge', uuid.generate('Casa Homekit Bridge'));

   // Listen for bridge identification event
   this.bridge.on('identify', (_paired, _callback) => {
      console.log(this.name + ": Node Bridge identify");
      _callback(); // success
   });

   // Publish the Bridge on the local network.
   setTimeout( () => {
      this.bridge.publish({ username: this.username, port: this.port,
                            pincode: this.pincode, category: Accessory.Categories.BRIDGE });
   }, 15000);
};

HomekitService.prototype.addAccessory = function(_accessory) {
  this.bridge.addBridgedAccessory(_accessory);
};

module.exports = exports = HomekitService;
