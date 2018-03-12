var util = require('util');
var HomekitAccessory = require('./hkaccessory');

var Accessory = require('hap-nodejs').Accessory;
var Service = require('hap-nodejs').Service;
var Characteristic = require('hap-nodejs').Characteristic;

function HomekitSecuritySystem(_config) {

   HomekitAccessory.call(this, _config);
   this.thingType = "homekit-security-system-accessory";

   this.ensurePropertyExists('current-state', 'property', { initialValue: Characteristic.SecuritySystemCurrentState.DISARMED }, _config);
   this.ensurePropertyExists('target-state', 'property', { initialValue: Characteristic.SecuritySystemTargetState.DISARM }, _config);
   this.ensurePropertyExists('system-fault', 'property', { initialValue: Characteristic.StatusFault.NO_FAULT }, _config);
   this.ensurePropertyExists('tamper-state', 'property', { initialValue: Characteristic.StatusTampered.NOT_TAMPERED }, _config);

   this.ensurePropertyExists('tamper-alarm', 'property', { initialValue: false }, _config);

   this.hkAccessory
      .addService(Service.SecuritySystem, this.displayName)
      .getCharacteristic(Characteristic.SecuritySystemCurrentState)
      .on('get', (_callback) => {
         _callback(null, this.getCurrentState());
      });

   this.hkAccessory
      .getService(Service.SecuritySystem) 
      .getCharacteristic(Characteristic.SecuritySystemTargetState)
      .on('set', (_value, _callback) => {
         this.setTargetState(_value);
         _callback();
      })
      .on('get', (_callback) => {
         _callback(null, this.getTargetState());
      });

   this.hkAccessory
      .getService(Service.SecuritySystem)
      .addCharacteristic(Characteristic.StatusFault)
      .on('get', (_callback) => {
         _callback(null, this.getSystemFault());
      });

   this.hkAccessory
      .getService(Service.SecuritySystem)
      .addCharacteristic(Characteristic.StatusTampered)
      .on('get', (_callback) => {
         _callback(null, this.getTamperState());
      });

}

util.inherits(HomekitSecuritySystem, HomekitAccessory);

HomekitSecuritySystem.prototype.getCurrentState = function() {
   return this.props["current-state"].value;
};

HomekitSecuritySystem.prototype.getTargetState = function() {
   return this.props["target-state"].value;
};

HomekitSecuritySystem.prototype.setTargetState = function(_state) {
   console.log(this.uName + ": Changing target state to " + _state);
   this.setManualMode('target-state');
   this.alignPropertyValue("target-state", _state);
};

HomekitSecuritySystem.prototype.getSystemFault = function() {
   return this.props["system-fault"].value;
}

HomekitSecuritySystem.prototype.getTamperState = function() {
   return this.props["tamper-state"].value;
}

HomekitSecuritySystem.prototype.propertyAboutToChange = function(_propName, _propValue, _data) {

   if (_propName == "tamper-alarm") {
      this.alignPropertyValue("tamper-state", (_propValue) ? Characteristic.StatusTampered.TAMPERED : Characteristic.StatusTampered.NOT_TAMPERED);
   }
   else if (_propName == "current-state") {
      this.hkAccessory
        .getService(Service.SecuritySystem)
        .getCharacteristic(Characteristic.SecuritySystemCurrentState)
        .updateValue(_propValue);
   }
   else if (_propName == "target-state") {
      this.hkAccessory
        .getService(Service.SecuritySystem)
        .getCharacteristic(Characteristic.SecuritySystemTargetState)
        .updateValue(_propValue);
   }
   else if (_propName == "tamper-state") {
      this.hkAccessory
        .getService(Service.SecuritySystem)
        .getCharacteristic(Characteristic.StatusTampered)
        .updateValue(_propValue);
   }
   else if (_propName == "system-fault") {
      this.hkAccessory
        .getService(Service.SecuritySystem)
        .getCharacteristic(Characteristic.StatusFault)
        .updateValue(_propValue);
   }
};

module.exports = exports = HomekitSecuritySystem;
