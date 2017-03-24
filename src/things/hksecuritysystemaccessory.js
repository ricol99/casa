var util = require('util');
var HomekitAccessory = require('./hkaccessory');

var Accessory = require('hap-nodejs').Accessory;
var Service = require('hap-nodejs').Service;
var Characteristic = require('hap-nodejs').Characteristic;

function HomekitSecuritySystemAccessory(_config) {

   HomekitAccessory.call(this, _config);
   this.thingType = "homekit-security-system-accessory";

   this.brightnessSupported = _config.brightnessSupported;
   this.hueSupported = _config.hueSupported;
   this.saturationSupported = _config.saturationSupported;

   this.ensurePropertyExists('current-state', 'property', { initialValue: Characteristic.SecuritySystemCurrentState.DISARMED });
   this.ensurePropertyExists('target-state', 'property', { initialValue: Characteristic.SecuritySystemTargetState.DISARMED });
   this.ensurePropertyExists('system-fault', 'property', { initialValue: Characteristic.StatusFault.NO_FAULT });
   this.ensurePropertyExists('tamper-state', 'property', { initialValue: Characteristic.StatusTampered.NOT_TAMPERED });

   this.ensurePropertyExists('part-armed', 'property', { initialValue: false });
   this.ensurePropertyExists('fully-armed', 'property', { initialValue: false });
   this.ensurePropertyExists('tamper-alarm', 'property', { initialValue: false });
   this.ensurePropertyExists('alarm-triggered', 'property', { initialValue: false });
   this.ensurePropertyExists('confirmed-alarm', 'property', { initialValue: false });

   var that = this;

   this.hkAccessory
      .addService(Service.SecuritySystem, this.displayName)
      .getCharacteristic(Characteristic.SecuritySystemCurrentState)
      .on('get', function(_callback) {
         _callback(null, that.getCurrentState());
      });

   this.hkAccessory
      .getService(Service.SecuritySystem) 
      .getCharacteristic(Characteristic.SecuritySystemTargetState)
      //.on('set', function(_value, _callback) {
         //that.setTargetState(_value);
         //_callback();
      //})
      .on('get', function(_callback) {
         _callback(null, that.getTargetState());
      });

   this.hkAccessory
      .getService(Service.SecuritySystem)
      .addCharacteristic(Characteristic.StatusFault)
      .on('get', function(_callback) {
         _callback(null, that.getSystemFault());
      });

   this.hkAccessory
      .getService(Service.SecuritySystem)
      .addCharacteristic(Characteristic.StatusTampered)
      .on('get', function(_callback) {
         _callback(null, that.getTamperState());
      });

}

util.inherits(HomekitSecuritySystemAccessory, HomekitAccessory);

HomekitSecuritySystemAccessory.prototype.getCurrentState = function() {
   return this.props["current-state"].value;
};

HomekitSecuritySystemAccessory.prototype.getTargetState = function() {
   return this.props["target-state"].value;
};

HomekitSecuritySystemAccessory.prototype.setTargetState = function(_state) {
   console.log(this.uName + ": Changing target state to " + _state);
   this.props['target-state'].setManualMode(true);
   this.updateProperty("target-state", _state, { sourceName: this.uName });
};

HomekitSecuritySystemAccessory.prototype.getSystemFault = function() {
   return this.props["system-fault"].value;
}

HomekitSecuritySystemAccessory.prototype.getTamperState = function() {
   return this.props["tamper-state"].value;
}

HomekitSecuritySystemAccessory.prototype.updateProperty = function(_propName, _propValue, _data) {

   if (_propName == "part-armed") {
      this.updateProperty("target-state", (_propValue) ? Characteristic.SecuritySystemCurrentState.STAY_ARM : Characteristic.SecuritySystemCurrentState.DISARMED, _data);
      this.updateProperty("current-state", (_propValue) ? Characteristic.SecuritySystemCurrentState.STAY_ARM : Characteristic.SecuritySystemCurrentState.DISARMED, _data);
   }
   else if (_propName == "fully-armed") {
      this.updateProperty("target-state", (_propValue) ? Characteristic.SecuritySystemCurrentState.AWAY_ARM : Characteristic.SecuritySystemCurrentState.DISARMED, _data);
      this.updateProperty("current-state", (_propValue) ? Characteristic.SecuritySystemCurrentState.AWAY_ARM : Characteristic.SecuritySystemCurrentState.DISARMED, _data);
   }
   else if (_propName == "tamper-alarm") {
      this.updateProperty("tamper-state", (_propValue) ? Characteristic.StatusTampered.TAMPERED : Characteristic.StatusTampered.NOT_TAMPERED, _data);
   }
   else if (_propName == "zone-alarm") {
      this.updateProperty("target-state", (_propValue) ? Characteristic.SecuritySystemTargetState.ALARM_TRIGGERED : Characteristic.SecuritySystemTargetState.DISARMED, _data);
      this.updateProperty("current-state", (_propValue) ? Characteristic.SecuritySystemCurrentState.ALARM_TRIGGERED : Characteristic.SecuritySystemCurrentState.DISARMED, _data);
   }
   else if (_propName == "confirmed-alarm") {
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

   HomekitAccessory.prototype.updateProperty.call(this, _propName, _propValue, _data);
};

module.exports = exports = HomekitSecuritySystemAccessory;
