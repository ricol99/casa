var util = require('util');
var HomekitAccessory = require('./hkaccessory');

var Accessory = require('hap-nodejs').Accessory;
var Service = require('hap-nodejs').Service;
var Characteristic = require('hap-nodejs').Characteristic;

function HomekitLightSensorAccessory(_config, _parent) {

   HomekitAccessory.call(this, _config, _parent);
   this.thingType = "homekit-light-accessory";

   this.ensurePropertyExists('light-level', 'property', { initialValue: 1 }, _config);

   this.hkAccessory
      .addService(Service.LightSensor, this.displayName) // services exposed to the user should have "names" like "LightSensor" for this case
      .getCharacteristic(Characteristic.CurrentAmbientLightLevel)
      .on('get', (_callback) => {
         _callback(null, this.getCurrentLightLevel());
      });
}

util.inherits(HomekitLightSensorAccessory, HomekitAccessory);

// Called when current state required
HomekitLightSensorAccessory.prototype.export = function(_exportObj) {
   HomekitAccessory.prototype.export.call(this, _exportObj);
};

// Called when current state required
HomekitLightSensorAccessory.prototype.import = function(_importObj) {
   HomekitAccessory.prototype.import.call(this, _importObj);
};

HomekitLightSensorAccessory.prototype.coldStart = function() {
   HomekitAccessory.prototype.coldStart.call(this);
};

HomekitLightSensorAccessory.prototype.hotStart = function() {
   HomekitAccessory.prototype.hotStart.call(this);
};

HomekitLightSensorAccessory.prototype.getCurrentLightLevel = function() {
   return this.properties["light-level"].value;
};

HomekitLightSensorAccessory.prototype.propertyAboutToChange = function(_propName, _propValue, _data) {

   if (_propName == "light-level") {
      this.hkAccessory
        .getService(Service.LightSensor)
        .getCharacteristic(Characteristic.CurrentAmbientLightLevel)
        .updateValue(_propValue);
   }
};

module.exports = exports = HomekitLightSensorAccessory;

