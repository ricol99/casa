var util = require('util');
var HomekitAccessory = require('./hkaccessory');

var Accessory = require('hap-nodejs').Accessory;
var Service = require('hap-nodejs').Service;
var Characteristic = require('hap-nodejs').Characteristic;

function HomekitGarageDoorOpenerAccessory(_config, _parent) {

   HomekitAccessory.call(this, _config, _parent);
   this.thingType = "homekit-humidifier-dehumidifier-accessory";

   this.ensurePropertyExists('target', 'property', {}, _config);
   this.ensurePropertyExists('target-state', 'property', {}, _config);
   this.ensurePropertyExists('current-state', 'property', {}, _config);
   this.ensurePropertyExists('obstruction-detected', 'property', { initialValue: false }, _config);

   this.hkService = this.hkAccessory.addService(Service.GarageDoorOpener, this.displayName) // services exposed to the user should have "names" like "HumiditySensor" for this case

   this.hkService.getCharacteristic(Characteristic.ObstructionDetected)
       .on('get', (_callback) => {
          _callback(null, this.getProperty("obstruction-detected")); 
       });

   this.hkService.getCharacteristic(Characteristic.TargetDoorState)
       .on('get', (_callback) => {
          _callback(null, this.getProperty("target-state")); 
       })
       .on('set', (_value, _callback) => {
          this.setTargetState(_value);
          _callback();
       });

   this.hkService.getCharacteristic(Characteristic.CurrentDoorState)
       .on('get', (_callback) => {
          _callback(null, this.getProperty("current-state")); 
       });
}

util.inherits(HomekitGarageDoorOpenerAccessory, HomekitAccessory);

HomekitGarageDoorOpenerAccessory.prototype.setTargetState = function(_value) {
   this.alignPropertyValue("target-state", _value);

   switch (_value) {
      case Characteristic.TargetDoorState.OPEN:
         this.alignPropertyValue("target", "open");
         break;
      case Characteristic.TargetDoorState.CLOSED:
         this.alignPropertyValue("target", "closed");
         break;
   }
};

HomekitGarageDoorOpenerAccessory.prototype.propertyAboutToChange = function(_propName, _propValue, _data) {

   if (_propName === "obstruction-detected") {
      this.hkAccessory
        .getService(Service.GarageDoorOpener)
        .getCharacteristic(Characteristic.ObstructionDetected)
        .updateValue(_propValue);
   }
   else if (_propName === "target-state") {
      this.hkAccessory
        .getService(Service.GarageDoorOpener)
        .getCharacteristic(Characteristic.TargetDoorState)
        .updateValue(_propValue);
   }
   else if (_propName === "current-state") {
      this.hkAccessory
        .getService(Service.GarageDoorOpener)
        .getCharacteristic(Characteristic.CurrentDoorState)
        .updateValue(_propValue);

      if (_propValue < 2 && this.getProperty("target-state") !== _propValue) {
         this.alignPropertyValue("target-state", _propValue);
      }
   }
};

module.exports = exports = HomekitGarageDoorOpenerAccessory;

