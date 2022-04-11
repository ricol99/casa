var util = require('util');
var HomekitAccessory = require('./hkaccessory');

var Accessory = require('hap-nodejs').Accessory;
var Service = require('hap-nodejs').Service;
var Characteristic = require('hap-nodejs').Characteristic;

function HomekitHumidifierDehumidifierAccessory(_config, _parent) {

   HomekitAccessory.call(this, _config, _parent);
   this.thingType = "homekit-humidifier-dehumidifier-accessory";

   this.ensurePropertyExists('water-level', 'property', { initialValue: 0 }, _config);
   this.ensurePropertyExists('current-relative-humidity', 'property', { initialValue: 0 }, _config);
   this.ensurePropertyExists('active-state', 'property', { initialValue: Characteristic.Active.INACTIVE }, _config);
   this.ensurePropertyExists('target-state', 'property', { initialValue: Characteristic.TargetHumidifierDehumidifierState.HUMIDIFIER_OR_DEHUMIDIFIER }, _config);
   this.ensurePropertyExists('current-state', 'property', { initialValue: Characteristic.CurrentHumidifierDehumidifierState.INACTIVE }, _config);

   this.hkService = this.hkAccessory.addService(Service.HumidifierDehumidifier, this.displayName) // services exposed to the user should have "names" like "HumiditySensor" for this case

   this.hkService.getCharacteristic(Characteristic.WaterLevel)
       .on('get', (_callback) => {
          _callback(null, this.getProperty("water-level")); 
       });

   this.hkService.getCharacteristic(Characteristic.CurrentRelativeHumidity)
       .on('get', (_callback) => {
          _callback(null, this.getProperty("current-relative-humidity"));
       });

   this.hkService.getCharacteristic(Characteristic.Active)
       .on('get', (_callback) => {
          _callback(null, this.getProperty("active-state")); 
       })
       .on('set', (_value, _callback) => {
          this.setActiveState(_value);
          _callback();
       });

   this.hkService.getCharacteristic(Characteristic.TargetHumidifierDehumidifierState)
       .on('get', (_callback) => {
          _callback(null, this.getProperty("target-state")); 
       })
       .on('set', (_value, _callback) => {
          this.setTargetState(_value);
          _callback();
       });

   this.hkService.getCharacteristic(Characteristic.CurrentHumidifierDehumidifierState)
       .on('get', (_callback) => {
          _callback(null, this.getProperty("current-state")); 
       });
}

util.inherits(HomekitHumidifierDehumidifierAccessory, HomekitAccessory);

// Called when current state required
HomekitHumidifierDehumidifierAccessory.prototype.export = function(_exportObj) {
   HomekitAccessory.prototype.export.call(this, _exportObj);
};

// Called when current state required
HomekitHumidifierDehumidifierAccessory.prototype.import = function(_importObj) {
   HomekitAccessory.prototype.import.call(this, _importObj);
};

HomekitHumidifierDehumidifierAccessory.prototype.coldStart = function() {
   HomekitAccessory.prototype.coldStart.call(this);
};

HomekitHumidifierDehumidifierAccessory.prototype.hotStart = function() {
   HomekitAccessory.prototype.hotStart.call(this);
};

HomekitHumidifierDehumidifierAccessory.prototype.setActiveState = function(_value) {
   this.alignPropertyValue("active-state", _value);

   switch (_value) {
      case Characteristic.Active.INACTIVE:
         this.alignPropertyValue("target-state", Characteristic.CurrentHumidifierDehumidifierState.INACTIVE);
         break;
      case Characteristic.Active.ACTIVE:
         this.alignPropertyValue("current-state", Characteristic.CurrentHumidifierDehumidifierState.IDLE);
         break;
   }

};

HomekitHumidifierDehumidifierAccessory.prototype.setTargetState = function(_value) {
   this.alignPropertyValue("target-state", _value);

   switch (_value) {
      case Characteristic.TargetHumidifierDehumidifierState.HUMIDIFIER_OR_DEHUMIDIFIER:
         this.alignPropertyValue("current-state", Characteristic.CurrentHumidifierDehumidifierState.IDLE);
         break;
      case Characteristic.TargetHumidifierDehumidifierState.HUMIDIFIER:
         this.alignPropertyValue("current-state", Characteristic.CurrentHumidifierDehumidifierState.HUMIDIFYING);
         break;
      case Characteristic.TargetHumidifierDehumidifierState.DEHUMIDIFIER:
         this.alignPropertyValue("current-state", Characteristic.CurrentHumidifierDehumidifierState.DEHUMIDIFYING);
         break;
   }
};

HomekitHumidifierDehumidifierAccessory.prototype.getCurrentRelativeHumidity = function() {
   return this.getProperty("current-relative-humidity");
};

HomekitHumidifierDehumidifierAccessory.prototype.propertyAboutToChange = function(_propName, _propValue, _data) {

   if (_propName === "water-level") {
      this.hkAccessory
        .getService(Service.HumidifierDehumidifier)
        .getCharacteristic(Characteristic.WaterLevel)
        .updateValue(_propValue);
   }
   else if (_propName === "current-relative-humidity") {
      this.hkAccessory
        .getService(Service.HumidifierDehumidifier)
        .getCharacteristic(Characteristic.CurrentRelativeHumidity)
        .updateValue(_propValue);
   }
   else if (_propName === "target-state") {
      this.hkAccessory
        .getService(Service.HumidifierDehumidifier)
        .getCharacteristic(Characteristic.TargetHumidifierDehumidifierState)
        .updateValue(_propValue);
   }
   else if (_propName === "current-state") {
      this.hkAccessory
        .getService(Service.HumidifierDehumidifier)
        .getCharacteristic(Characteristic.CurrentHumidifierDehumidifierState)
        .updateValue(_propValue);
   }
};

module.exports = exports = HomekitHumidifierDehumidifierAccessory;

