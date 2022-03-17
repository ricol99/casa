var util = require('util');
var HomekitAccessory = require('./hkaccessory');

var Accessory = require('hap-nodejs').Accessory;
var Service = require('hap-nodejs').Service;
var Characteristic = require('hap-nodejs').Characteristic;

function HomekitTempSensorAccessory(_config, _parent) {

   HomekitAccessory.call(this, _config, _parent);
   this.thingType = "homekit-temperature-accessory";

   this.ensurePropertyExists("temperature", 'property', { initialValue: 0 }, _config);

   this.hkAccessory
      .addService(Service.TemperatureSensor, this.displayName) // services exposed to the user should have "names" like "TempSensor" for this case
      .getCharacteristic(Characteristic.CurrentTemperature)
      .on('get', (_callback) => {
         _callback(null, this.getCurrentTemperature());
      });
}

util.inherits(HomekitTempSensorAccessory, HomekitAccessory);

HomekitTempSensorAccessory.prototype.getCurrentTemperature = function() {
   return this.properties["temperature"].value;
};

HomekitTempSensorAccessory.prototype.propertyAboutToChange = function(_propName, _propValue, _data) {

   if (_propName === "temperature") {
      this.hkAccessory
        .getService(Service.TemperatureSensor)
        .getCharacteristic(Characteristic.CurrentTemperature)
        .updateValue(_propValue);
   }
};

module.exports = exports = HomekitTempSensorAccessory;

