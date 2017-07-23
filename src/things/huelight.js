var util = require('util');
var Thing = require('../thing');
var CasaSystem = require('../casasystem');

function HueLight(_config) {
   this.casaSys = CasaSystem.mainInstance();

   Thing.call(this, _config);
   this.thingType = "hue-light";

   this.deviceID = _config.deviceID;
   this.displayName = _config.displayName;

   this.ensurePropertyExists('power', 'property', { initialValue: false }, _config);

   this.brightnessSupported = true;
   this.ensurePropertyExists('brightness', 'property', { initialValue: 100 }, _config);

   this.hueService =  this.casaSys.findService("hueservice");

   if (!this.hueService) {
      console.error(this.uName + ": ***** Hue service not found! *************");
      process.exit();
   }

   var that = this;

   if (_config.hasOwnProperty("hueSupported")) {

      if (_config.hueSupported) {
         this.hueSupported = true;
         this.ensurePropertyExists('hue', 'property', { initialValue: 65535 }, _config);
      }

      if (_config.saturationSupported) {
         this.saturationSupported = true;
         this.ensurePropertyExists('saturation', 'property', { initialValue: 255 }, _config);
      }
   }
   else {
      this.hueService.getLightCapability(this.deviceID, function(_err, _result) {

         if (_err) {
            console.error(that.uName + ": Not able to find hue light id=", that.deviceId);
            return;
         }

         if (_result.hue) {
            that.hueSupported = true;
            that.ensurePropertyExists('hue', 'property', { initialValue: 65535 }, _config);
         }

         if (_result.saturation) {
            that.saturationSupported = true;
            that.ensurePropertyExists('saturation', 'property', { initialValue: 255 }, _config);
         }
      });
   }
}

util.inherits(HueLight, Thing);

function copyObject(_sourceObject) {
   var newObject = {};

   for (var prop in _sourceObject) {

      if (_sourceObject.hasOwnProperty(prop)){
         newObject[prop] = _sourceObject[prop];
      }
   }

   return newObject;
}

HueLight.prototype.propertyAboutToChange = function(_propName, _propValue, _data) {
   var that = this;

   if (_data.alignWithParent) {

      this.callbackHandler = function(_error, _content) {

         if (_error) {
            console.log(that.uName + ': Error turning room off ' + _error.message);
         }
      };

      if (!_data.coldStart) {

         if (_propName == "power") {

            if (_propValue) {
               this.hueService.turnLightOn(this.deviceID, this.callbackHandler);
            }
            else {
               this.hueService.turnLightOff(this.deviceID, this.callbackHandler);
            }
         }
         else if (_propName == "brightness") {
            this.hueService.setLightBrightness(this.deviceID, _propValue, this.callbackHandler);
            this.updateProperty("power", (_propValue > 0));
         }
         else if (_propName == "hue") {
            this.hueService.setLightHue(this.deviceID, _propValue, this.callbackHandler);
         }
         else if (_propName == "saturation") {
            this.hueService.setLightSaturation(this.deviceID, _propValue, this.callbackHandler);
         }
      }
   }
};


module.exports = exports = HueLight;
