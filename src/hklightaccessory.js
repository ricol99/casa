var util = require('util');
var HomekitAccessory = require('./hkaccessory');

var Accessory = require('hap-nodejs').Accessory;
var Service = require('hap-nodejs').Service;
var Characteristic = require('hap-nodejs').Characteristic;

function HomekitLightAccessory(_config) {

   HomekitAccessory.call(this, _config);
   this.thingType = "homekit-light-accessory";

   this.brightnessSupported = _config.brightnessSupported;
   this.hueSupported = _config.hueSupported;
   this.saturationSupported = _config.saturationSupported;

   var that = this;

   this.hkAccessory
      .addService(Service.Lightbulb, this.displayName) // services exposed to the user should have "names" like "Light" for this case
      .getCharacteristic(Characteristic.On)
      .on('set', function(_value, _callback) {
         that.setPower(_value);
         _callback();
      })
      // We want to intercept requests for our current power state so we can query the hardware itself instead of
      // allowing HAP-NodeJS to return the cached Characteristic.value.
      .on('get', function(_callback) {
         _callback(null, that.getPower());
      });

   if (this.brightnessSupported) {
      this.props["brightness"] = 0; 

      this.hkAccessory
        .getService(Service.Lightbulb)
        .addCharacteristic(Characteristic.Brightness)
        .on('set', function(_value, _callback) {
          that.setBrightness(_value);
          _callback();
        })
        .on('get', function(_callback) {
          _callback(null, that.getBrightness());
        });
   }

   if (this.saturationSupported) {
      this.props["hue"] = 0; 

      this.hkAccessory
        .getService(Service.Lightbulb)
        .addCharacteristic(Characteristic.Saturation)
        .on('set', function(_value, _callback) {
           that.setSaturation(_value);
           _callback();
        })
        .on('get', function(_callback) {
           _callback(null, that.getSaturation());
        });
   }

   if (this.hueSupported) {
      this.props["saturation"] = 0; 

      this.hkAccessory
         .getService(Service.Lightbulb)
         .addCharacteristic(Characteristic.Hue)
         .on('set', function(_value, _callback) {
            that.setHue(_value);
            _callback();
         })
         .on('get', function(_callback) {
            _callback(null, that.getHue());
         });
   }
}

util.inherits(HomekitLightAccessory, HomekitAccessory);

HomekitLightAccessory.prototype.setPower = function(_status) {
   console.log(this.name + ": Changing power status to " + _status ? "on" : "off");
   this.updateProperty("power", _status);
};

HomekitLightAccessory.prototype.getPower = function() {
   return this.props["power"];
};

HomekitLightAccessory.prototype.setBrightness = function(_status) {
   console.log(this.name + ": Changing brightness to " + _status);
   this.updateProperty("brightness", _status);
};

HomekitLightAccessory.prototype.getBrightness = function() {
   return this.props["brightness"];
}

HomekitLightAccessory.prototype.setSaturation = function(_status) {
   console.log(this.name + ": Changing saturation to " + _status);
   this.updateProperty("saturation", _status);
};

HomekitLightAccessory.prototype.getSaturation = function() {
   return this.props["saturation"];
}

HomekitLightAccessory.prototype.setHue = function(_status) {
   console.log(this.name + ": Changing hue to " + _status);
   this.updateProperty("hue", _status);
};

HomekitLightAccessory.prototype.getHue = function() {
   return this.props["hue"];
}

module.exports = exports = HomekitLightAccessory;

//****var lightAccessory = exports.accessory = new Accessory(LightController.name, lightUUID);

// To inform HomeKit about changes occurred outside of HomeKit (like user physically turn on the light)
// Please use Characteristic.updateValue
// 
// lightAccessory
//   .getService(Service.Lightbulb)
//   .getCharacteristic(Characteristic.On)
//   .updateValue(true);

