var util = require('util');
var HomekitAccessory = require('./hkaccessory');

var Accessory = require('hap-nodejs').Accessory;
var Service = require('hap-nodejs').Service;
var Characteristic = require('hap-nodejs').Characteristic;

function HomekitLightAccessory(_config, _parent) {

   HomekitAccessory.call(this, _config, _parent);
   this.thingType = "homekit-light-accessory";

   this.brightnessSupported = _config.brightnessSupported;
   this.hueSupported = _config.hueSupported;
   this.saturationSupported = _config.saturationSupported;
   this.colourTempSupported = _config.colourTempSupported;
   this.powerProp = _config.hasOwnProperty("powerProp") ? _config.powerProp : "power";

   this.ensurePropertyExists(this.powerProp, 'property', { initialValue: false }, _config);

   this.hkAccessory
      .addService(Service.Lightbulb, this.displayName) // services exposed to the user should have "names" like "Light" for this case
      .getCharacteristic(Characteristic.On)
      .on('set', (_value, _callback) => {
         this.setPower(_value);
         _callback();
      })
      // We want to intercept requests for our current power state so we can query the hardware itself instead of
      // allowing HAP-NodeJS to return the cached Characteristic.value.
      .on('get', (_callback) => {
         _callback(null, this.getPower());
      });

   if (this.brightnessSupported) {
      this.ensurePropertyExists('brightness', 'property', { initialValue: 100 }, _config);

      this.hkAccessory
        .getService(Service.Lightbulb)
        .addCharacteristic(Characteristic.Brightness)
        .on('set', (_value, _callback) => {
          this.setBrightness(_value);
          _callback();
        })
        .on('get', (_callback) => {
          _callback(null, this.getBrightness());
        });
   }

   if (this.saturationSupported) {
      this.ensurePropertyExists('saturation', 'property', { initialValue: 0 }, _config);

      this.hkAccessory
        .getService(Service.Lightbulb)
        .addCharacteristic(Characteristic.Saturation)
        .on('set', (_value, _callback) => {
           this.setSaturation(_value);
           _callback();
        })
        .on('get', (_callback) => {
           _callback(null, this.getSaturation());
        });
   }

   if (this.hueSupported) {
      this.ensurePropertyExists('hue', 'property', { initialValue: 0 }, _config);

      this.hkAccessory
         .getService(Service.Lightbulb)
         .addCharacteristic(Characteristic.Hue)
         .on('set', (_value, _callback) => {
            this.setHue(_value);
            _callback();
         })
         .on('get', (_callback) => {
            _callback(null, this.getHue());
         });
   }

   if (this.colourTempSupported) {
      this.ensurePropertyExists('colour-temp', 'property', { initialValue: 0 }, _config);

      this.hkAccessory
         .getService(Service.Lightbulb)
         .addCharacteristic(Characteristic.ColorTemperature)
         .on('set', (_value, _callback) => {
            this.setColourTemp(_value);
            _callback();
         })
         .on('get', (_callback) => {
            _callback(null, this.getColourTemp());
         });
   }
}

util.inherits(HomekitLightAccessory, HomekitAccessory);

// Called when current state required
HomekitLightAccessory.prototype.export = function(_exportObj) {
   HomekitAccessory.prototype.export.call(this, _exportObj);
};

// Called when current state required
HomekitLightAccessory.prototype.import = function(_importObj) {
   HomekitAccessory.prototype.import.call(this, _importObj);
};

HomekitLightAccessory.prototype.coldStart = function() {
   HomekitAccessory.prototype.coldStart.call(this);
};

HomekitLightAccessory.prototype.hotStart = function() {
   HomekitAccessory.prototype.hotStart.call(this);
};

HomekitLightAccessory.prototype.setPower = function(_status) {
   console.log(this.uName + ": Changing " + this.powerProp + " to " + _status);
   this.setManualMode();
   this.alignPropertyValue(this.powerProp, _status ? true : false);
};

HomekitLightAccessory.prototype.getPower = function() {
   return this.properties[this.powerProp].value ? 1 : 0;
};

HomekitLightAccessory.prototype.setBrightness = function(_status) {
   console.log(this.uName + ": Changing brightness to " + _status);
   this.setManualMode();
   this.alignPropertyValue("brightness", _status);
};

HomekitLightAccessory.prototype.getBrightness = function() {
   return this.properties["brightness"].value;
}

HomekitLightAccessory.prototype.setSaturation = function(_status) {
   console.log(this.uName + ": Changing saturation to " + _status);
   this.setManualMode();
   this.alignPropertyValue("saturation", _status);
};

HomekitLightAccessory.prototype.getSaturation = function() {
   return this.properties["saturation"].value;
};

HomekitLightAccessory.prototype.setHue = function(_status) {
   console.log(this.uName + ": Changing hue to " + _status);
   this.setManualMode();
   this.alignPropertyValue("hue", _status);
};

HomekitLightAccessory.prototype.getHue = function() {
   return this.properties["hue"].value;
};

HomekitLightAccessory.prototype.getColourTemp = function() {
   return this.properties["colour-temp"].value;
};

HomekitLightAccessory.prototype.setColourTemp = function(_status) {
   console.log(this.uName + ": Changing colour temperature to " + _status);
   this.setManualMode();
   this.alignPropertyValue("colour-temp", _status);
};

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
   else if (_propName == "colour-temp") {
      this.hkAccessory
        .getService(Service.Lightbulb)
        .getCharacteristic(Characteristic.ColorTemperature)
        .updateValue(_propValue);
   }
};

module.exports = exports = HomekitLightAccessory;
