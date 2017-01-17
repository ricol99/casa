var util = require('util');
var Thing = require('./thing');

var Accessory = require('hap-nodejs').Accessory;
var Service = require('hap-nodejs').Service;
var Characteristic = require('hap-nodejs').Characteristic;
var uuid = require('hap-nodejs').uuid;
"use strict"

function HomekitAccessory(_config) {

   Thing.call(this, _config);
   this.thingType = "homekit-accessory";
   this.port = this.casa.allocatePort(this.name);

   this.displayName = _config.displayName;
   this.pincode = _config.pincode;
   this.username = _config.username;
   this.manufacturer = (_config.manufacturer == undefined) ? "Casa" : _config.manufacturer;
   this.model = (_config.model == undefined) ? "v1.0" : _config.model;
   this.serialNumber = (_config.serialNumber == undefined) ? "XXXXXXX" : _config.serialNumber;

   this.hkUUID = uuid.generate('hap-nodejs:accessories:' + this.thingType + ':' + this.name);
   this.hkAccessory = new Accessory(this.displayName, this.hkUUID);
   this.hkAccessory.username = this.username;
   this.hkAccessory.pincode = this.pincode;

   var that = this;

   this.hkAccessory
     .getService(Service.AccessoryInformation)
       .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
       .setCharacteristic(Characteristic.Model, this.model)
       .setCharacteristic(Characteristic.SerialNumber, this.serialNumber);

   this.hkAccessory.on('identify', function(_paired, _callback) {
      that.identify();
      _callback();
   });
}

util.inherits(HomekitAccessory, Thing);

HomekitAccessory.prototype.coldStart = function() {

  this.hkAccessory.publish({
    port: this.port,
    username: this.username,
    pincode: this.pincode
  });

  Thing.prototype.coldStart.call(this);
};

HomekitAccessory.prototype.identify = function() {
};

module.exports = exports = HomekitAccessory;
