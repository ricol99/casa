var util = require('util');
var Thing = require('../thing');

function HueLight(_config) {
   Thing.call(this, _config);
   this.thingType = "hue-light";
   this.displayName = _config.displayName;
   this.deviceId = _config.deviceId;

   this.ensurePropertyExists('power', 'property', { initialValue: false }, _config);

   this.hueService =  this.gang.findService("hueservice");

   if (!this.hueService) {
      console.error(this.uName + ": ***** Hue service not found! *************");
      process.exit();
   }

   this.brightnessSupported = _config.hasOwnProperty("brightnessSupported") ? _config.brightnessSupported : true;

   if (this.brightnessSupported)  {
      this.ensurePropertyExists('brightness', 'property', { initialValue: 100 }, _config);
   }

   if (_config.hasOwnProperty("hueSupported")) {

      if (_config.hueSupported) {
         this.hueSupported = true;
         this.ensurePropertyExists('hue', 'property', { initialValue: 360 }, _config);
      }

      if (_config.saturationSupported) {
         this.saturationSupported = true;
         this.ensurePropertyExists('saturation', 'property', { initialValue: 100 }, _config);
      }
   }
   else {
      this.hueService.getLightCapability(this.deviceId, (_err, _result) => {

         if (_err) {
            console.error(this.uName + ": Not able to find hue light id=", this.deviceId);
            return;
         }

         if (_result.hue) {
            this.hueSupported = true;
            this.ensurePropertyExists('hue', 'property', { initialValue: 360 }, _config);
         }

         if (_result.saturation) {
            this.saturationSupported = true;
            this.ensurePropertyExists('saturation', 'property', { initialValue: 100 }, _config);
         }
      });
   }
}

util.inherits(HueLight, Thing);

HueLight.prototype.propertyAboutToChange = function(_propName, _propValue, _data) {

   if (!_data.coldStart) {

      if (_propName == "power") {

         if (_propValue) {
            this.hueService.turnLightOn(this.deviceId);
            this.syncDeviceProperties();
         }
         else {
            this.hueService.turnLightOff(this.deviceId);
         }
      }
      else if (this.getProperty("power")) {
         this.syncDeviceProperty(_propName, _propValue);
      }
   }
};

HueLight.prototype.syncDeviceProperties = function() {
   var config = { power: true };

   if (this.brightnessSupported) {
      config[brightness] =  this.getProperty("brightness");
   }

   if (this.hueSupported) {
      config[hue] =  this.getProperty("hue");
   }

   if (this.saturationSupported)  {
       config[saturation] =  this.getProperty("saturation");
   }

   this.hueService.setLightState(this.deviceId, config);
};

HueLight.prototype.syncDeviceProperty = function(_propName, _propValue) {

   var f = { brightness: "setLightBrightness", hue: "setLightHue",
             saturation: "setLightSaturation" };

   if (f[_propName]) {
      this.hueService[f[_propName]].call(this.hueService, this.deviceId, _propValue);
   }
};

HueLight.prototype.coldStart = function() {
   Thing.prototype.coldStart.call(this);
};

module.exports = exports = HueLight;
