var util = require('util');
var Thing = require('../thing');
var storage = require('node-persist');
const HAP = require('hap-nodejs');
HAP.init();

var Accessory = HAP.Accessory;
var Service = HAP.Service;
var Characteristic = HAP.Characteristic;
var uuid = HAP.uuid;

storage.initSync();

function HomekitAccessory(_config, _parent) {

   Thing.call(this, _config, _parent);
   this.thingType = "homekit-accessory";

   this.displayName = _config.displayName;
   this.manufacturer = (_config.manufacturer == undefined) ? "Casa" : _config.manufacturer;
   this.model = (_config.model == undefined) ? "v1.0" : _config.model;
   this.serialNumber = (_config.serialNumber == undefined) ? "XXXXXXX" : _config.serialNumber;
   this.invokeManualMode = (_config.hasOwnProperty("invokeManualMode")) ? _config.invokeManualMode : true;
   this.manualModeDuration = (_config.hasOwnProperty("manualModeDuration")) ? _config.manualModeDuration : 3600;
   this.service = (_config.hasOwnProperty("service")) ? _config.service : "homekitservice";

   this.hkUUID = uuid.generate('hap-nodejs:accessories:' + this.thingType + ':' + this.uName);
   this.hkAccessory = new Accessory(this.displayName, this.hkUUID);

   this.homekitService = this.casa.findService(this.service);

   if (this.homekitService) {
      console.log(this.uName+": Homekit service found, so using bridge configuration");
   }
   else {
      console.log(this.uName+": Homekit service not found, so publishing each accessory separately");
      this.pincode = _config.pincode;
      this.username = _config.username;
      this.hkAccessory.username = this.username;
      this.hkAccessory.pincode = this.pincode;
      this.port = this.casa.allocatePort(this.uName);
   }
}

util.inherits(HomekitAccessory, Thing);

// Called when current state required
HomekitAccessory.prototype.export = function(_exportObj) {
   Thing.prototype.export.call(this, _exportObj);
};

// Called when current state required
HomekitAccessory.prototype.import = function(_importObj) {
   Thing.prototype.import.call(this, _importObj);
};

HomekitAccessory.prototype.hotStart = function() {
   this.start();
   Thing.prototype.hotStart.call(this);
};

HomekitAccessory.prototype.coldStart = function() {
   this.start();
   Thing.prototype.coldStart.call(this);
};

HomekitAccessory.prototype.start = function() {

   this.hkAccessory
     .getService(Service.AccessoryInformation)
       .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
       .setCharacteristic(Characteristic.Model, this.model)
       .setCharacteristic(Characteristic.SerialNumber, this.serialNumber);

   if (this.homekitService) {
      this.homekitService.addAccessory(this.hkAccessory);

      this.hkAccessory.on('identify', (_paired, _callback) => {
         this.identify();
         _callback();
      });
   }
   else {

      this.hkAccessory.on('identify', (_paired, _callback) => {
         this.identify();
         _callback();
      });

      this.hkAccessory.publish({
         port: this.port,
         username: this.username,
         pincode: this.pincode
      });
   }
};

HomekitAccessory.prototype.identify = function() {
};

// _property is not mandatory
HomekitAccessory.prototype.setManualMode = function() {

   if (this.invokeManualMode) {
      Thing.prototype.setManualMode.call(this, this.manualModeDuration);
   }
};

module.exports = exports = HomekitAccessory;
