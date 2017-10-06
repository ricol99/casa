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
   this.powerProp = _config.hasOwnProperty("powerProp") ? _config.powerProp : "power";

   this.ensurePropertyExists(this.powerProp, 'property', { initialValue: false }, _config);

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
      this.ensurePropertyExists('brightness', 'property', { initialValue: 100 }, _config);

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
      this.ensurePropertyExists('saturation', 'property', { initialValue: 0 }, _config);

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
      this.ensurePropertyExists('hue', 'property', { initialValue: 0 }, _config);

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
   console.log(this.uName + ": Changing " + this.powerProp + " to " + _status);
   this.setManualMode();
   this.alignPropertyValue(this.powerProp, _status ? true : false);
};

HomekitLightAccessory.prototype.getPower = function() {
   return this.props[this.powerProp].value ? 1 : 0;
};

HomekitLightAccessory.prototype.setBrightness = function(_status) {
   console.log(this.uName + ": Changing brightness to " + _status);
   this.setManualMode();
   this.alignPropertyValue("brightness", _status);
};

HomekitLightAccessory.prototype.getBrightness = function() {
   return this.props["brightness"].value;
}

HomekitLightAccessory.prototype.setSaturation = function(_status) {
   console.log(this.uName + ": Changing saturation to " + _status);
   this.setManualMode();
   this.alignPropertyValue("saturation", _status);
};

HomekitLightAccessory.prototype.getSaturation = function() {
   return this.props["saturation"].value;
}

HomekitLightAccessory.prototype.setHue = function(_status) {
   console.log(this.uName + ": Changing hue to " + _status);
   this.setManualMode();
   this.alignPropertyValue("hue", _status);
};

HomekitLightAccessory.prototype.getHue = function() {
   return this.props["hue"].value;
}

HomekitLightAccessory.prototype.propertyAboutToChange = function(_propName, _propValue, _data) {

   if (_propName == this.powerProp) {
      this.hkAccessory
        .getService(Service.Lightbulb)
        .getCharacteristic(Characteristic.On)
        .updateValue(_propValue ? 1 : 0);
   }
   else if (_propName == "brightness") {
      this.hkAccessory
        .getService(Service.Lightbulb)
        .getCharacteristic(Characteristic.Brightness)
        .updateValue(_propValue);
   }
   else if (_propName == "saturation") {
      this.hkAccessory
        .getService(Service.Lightbulb)
        .getCharacteristic(Characteristic.Saturation)
        .updateValue(_propValue);
   }
   else if (_propName == "hue") {
      this.hkAccessory
        .getService(Service.Lightbulb)
        .getCharacteristic(Characteristic.Hue)
        .updateValue(_propValue);
   }
};

module.exports = exports = HomekitLightAccessory;
