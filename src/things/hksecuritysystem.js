var util = require('util');
var HomekitAccessory = require('./hkaccessory');

var Accessory = require('hap-nodejs').Accessory;
var Service = require('hap-nodejs').Service;
var Characteristic = require('hap-nodejs').Characteristic;

function HomekitSecuritySystem(_config, _parent) {
   _config.invokeManualMode = false;
   HomekitAccessory.call(this, _config, _parent);
   this.thingType = "homekit-security-system-accessory";

   //this.ensurePropertyExists('current-state', 'property', { initialValue: Characteristic.SecuritySystemCurrentState.DISARMED }, _config);
   //this.ensurePropertyExists('target-state', 'property', { initialValue: Characteristic.SecuritySystemTargetState.DISARM }, _config);
   //this.ensurePropertyExists('system-fault', 'property', { initialValue: Characteristic.StatusFault.NO_FAULT }, _config);
   //this.ensurePropertyExists('tamper-state', 'property', { initialValue: Characteristic.StatusTampered.NOT_TAMPERED }, _config);
   this.ensurePropertyExists('current-state', 'property', { }, _config);
   this.ensurePropertyExists('target-state', 'property', { }, _config);
   this.ensurePropertyExists('system-fault', 'property', { }, _config);
   this.ensurePropertyExists('tamper-state', 'property', { }, _config);

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
         _callback(this.setTargetState(_value) ? null : true);
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

// Called when current state required
HomekitSecuritySystem.prototype.export = function(_exportObj) {
   HomekitAccessory.prototype.export.call(this, _exportObj);
};

// Called when current state required
HomekitSecuritySystem.prototype.import = function(_importObj) {
   HomekitAccessory.prototype.import.call(this, _importObj);
};

HomekitSecuritySystem.prototype.coldStart = function() {
   HomekitAccessory.prototype.coldStart.call(this);
};

HomekitSecuritySystem.prototype.hotStart = function() {
   HomekitAccessory.prototype.hotStart.call(this);
};

HomekitSecuritySystem.prototype.mapCurrentStateFromPropToHk = function(_state) {
   var map = { stay: 0, away: 1, night: 2, disarmed: 3, triggered:4 };
   return isNumber(this.properties["current-state"].value) ? _state : map[_state];
};

HomekitSecuritySystem.prototype.getCurrentState = function() {
   return this.mapCurrentStateFromPropToHk(this.properties["current-state"].value);
};

HomekitSecuritySystem.prototype.mapTargetStateFromPropToHk = function(_state) {
   var map = { stay: 0, away: 1, night: 2, disarmed: 3, triggered:4 };
   var prop = this.properties["target-state"].value;
   return isNumber(prop) ? _state : map[_state];
};

HomekitSecuritySystem.prototype.getTargetState = function() {
   return this.mapTargetStateFromPropToHk(this.properties["target-state"].value);
};

HomekitSecuritySystem.prototype.mapTargetStateFromHkToProp = function(_state) {
   var map = { 0: "stay", 1: "away", 2: "night", 3: "disarmed", 4: "triggered" };
   return isNumber(this.properties["target-state"].value) ? _state : map[_state];
};

HomekitSecuritySystem.prototype.setTargetState = function(_state) {

   var comp = isNumber(this.properties["target-state"].value) ? Characteristic.SecuritySystemTargetState.DISARM : "disarm"
   
   if ((_state !== Characteristic.SecuritySystemTargetState.DISARM) &&
       (Characteristic.SecuritySystemTargetState.DISARM !== this.mapTargetStateFromPropToHk(this.properties["target-state"].value))) {
      return false;
   }

   console.log(this.uName + ": Changing target state to " + _state);
   this.setManualMode('target-state');
   this.alignPropertyValue("target-state", this.mapTargetStateFromHkToProp(_state));
   return true;
};

HomekitSecuritySystem.prototype.getSystemFault = function() {
   return this.properties["system-fault"].value;
}

HomekitSecuritySystem.prototype.getTamperState = function() {
   return this.properties["tamper-state"].value;
}

HomekitSecuritySystem.prototype.propertyAboutToChange = function(_propName, _propValue, _data) {

   if (_propName == "tamper-alarm") {
      this.alignPropertyValue("tamper-state", (_propValue) ? Characteristic.StatusTampered.TAMPERED : Characteristic.StatusTampered.NOT_TAMPERED);
   }
   else if (_propName == "current-state") {
      this.hkAccessory
        .getService(Service.SecuritySystem)
        .getCharacteristic(Characteristic.SecuritySystemCurrentState)
        .updateValue(this.mapCurrentStateFromPropToHk(_propValue));
   }
   else if (_propName == "target-state") {
      this.hkAccessory
        .getService(Service.SecuritySystem)
        .getCharacteristic(Characteristic.SecuritySystemTargetState)
        .updateValue(this.mapTargetStateFromPropToHk(_propValue));
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

function isNumber(_input) {
   return (typeof _input === "number") ? true : ((typeof _input === "string") ? !isNaN(_input) && !isNaN(parseInt(_input)) : false);
}

module.exports = exports = HomekitSecuritySystem;
