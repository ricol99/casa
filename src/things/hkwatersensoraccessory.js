var util = require('util');
var HomekitAccessory = require('./hkaccessory');

var Accessory = require('hap-nodejs').Accessory;
var Service = require('hap-nodejs').Service;
var Characteristic = require('hap-nodejs').Characteristic;

function HomekitWaterLevelSensorAccessory(_config, _parent) {

   HomekitAccessory.call(this, _config, _parent);
   this.thingType = "homekit-water-level-accessory";

   this.ensurePropertyExists('water-level', 'property', { initialValue: 1 }, _config);

   this.hkAccessory
      .addService(Service.HumiditySensor, this.displayName) // services exposed to the user should have "names" like "HumiditySensor" for this case
      .getCharacteristic(Characteristic.WaterLevel)
      .on('get', (_callback) => {
         _callback(null, this.getCurrentWaterLevel());
      });
}

util.inherits(HomekitWaterSensorAccessory, HomekitAccessory);

HomekitWaterSensorAccessory.prototype.getCurrentWaterLevel = function() {
   return this.props["water-level"].value;
};

HomekitWaterSensorAccessory.prototype.propertyAboutToChange = function(_propName, _propValue, _data) {

   if (_propName === "water-level") {
      this.hkAccessory
        .getService(Service.WaterSensor)
        .getCharacteristic(Characteristic.WaterLevel)
        .updateValue(_propValue);
   }
};

module.exports = exports = HomekitWaterSensorAccessory;

