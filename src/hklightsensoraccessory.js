var util = require('util');
var HomekitAccessory = require('./hkaccessory');

var Accessory = require('hap-nodejs').Accessory;
var Service = require('hap-nodejs').Service;
var Characteristic = require('hap-nodejs').Characteristic;

function HomekitLightSensorAccessory(_config) {

   HomekitAccessory.call(this, _config);
   this.thingType = "homekit-light-accessory";

   this.props["light-level"] = 1;

   var that = this;

   this.hkAccessory
      .addService(Service.LightSensor, this.displayName) // services exposed to the user should have "names" like "LightSensor" for this case
      .getCharacteristic(Characteristic.CurrentAmbientLightLevel)
      .on('get', function(_callback) {
         _callback(null, that.getCurrentLightLevel());
      });
}

util.inherits(HomekitLightSensorAccessory, HomekitAccessory);

HomekitLightSensorAccessory.prototype.getCurrentLightLevel = function() {
   return this.props["light-level"];
};

HomekitLightSensorAccessory.prototype.updateProperty = function(_propName, _propValue, _data) {

   if (_propName == "light-level") {
      this.hkAccessory
        .getService(Service.LightSensor)
        .getCharacteristic(Characteristic.CurrentAmbientLightLevel)
        .updateValue(_propValue);
   }

   HomekitAccessory.prototype.updateProperty.call(this, _propName, _propValue, _data);
};

module.exports = exports = HomekitLightSensorAccessory;

// To inform HomeKit about changes occurred outside of HomeKit (like user physically turn on the light)
// Please use Characteristic.updateValue
// 
// lightAccessory
//   .getService(Service.LightSensor)
//   .getCharacteristic(Characteristic.On)
//   .updateValue(true);

