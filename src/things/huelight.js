var util = require('util');
var Thing = require('../thing');
var CasaSystem = require('../casasystem');

function HueLight(_config) {
   Thing.call(this, _config);
   this.thingType = "hue-light";

   this.deviceId = _config.deviceId;
   this.displayName = _config.displayName;
   this.powerPending = false;

   this.ensurePropertyExists('power', 'property', { initialValue: false }, _config);

   this.brightnessSupported = true;
   this.ensurePropertyExists('brightness', 'property', { initialValue: 100 }, _config);

   this.hueService =  this.casaSys.findService("hueservice");

   if (!this.hueService) {
      console.error(this.uName + ": ***** Hue service not found! *************");
      process.exit();
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

   if (!_data.coldStart) {

      if (_propName == "power") {

         if (_propValue) {
            //this.hueService.turnLightOn(this.deviceId, (_error, _content) => {

               //if (_error) {
                  //console.log(this.uName + ': Error turning room on ' + _error.message);
               //}
               //else {
                  this.syncDeviceProperties();
               //}
            //});
         }
         else {
            this.hueService.turnLightOff(this.deviceId, (_error, _content) => {

               if (_error) {
                  console.log(this.uName + ': Error turning room off ' + _error.message);
               }
            });
         }
      }
      else if (this.getProperty("power")) {
         this.syncDeviceProperty(_propName, _propValue);
      }
   }
};

HueLight.prototype.syncDeviceProperties = function() {

   this.hueService.setLightState(this.deviceId, { power: true, brightness: this.getProperty("brightness"),
                                                  hue: this.getProperty("hue"), saturation: this.getProperty("saturation") },
                                                  (_error, _content) => {

      if (_error) {
         console.error(this.uName + ': Error syncing device properites -  ' + _error.message);
      }
   });
};

HueLight.prototype.syncDeviceProperty = function(_propName, _propValue) {

   if (!this.getProperty("power")) {
      return;
   }

   var config = { power: true, brightness: this.getProperty("brightness"), hue: this.getProperty("hue"), saturation: this.getProperty("saturation") };
   config[_propName] = _propValue;

   this.hueService.setLightState(this.deviceId, { power: true, brightness: this.getProperty("brightness"),
                                                  hue: this.getProperty("hue"), saturation: this.getProperty("saturation") },
                                                  (_error, _content) => {

      if (_error) {
         console.error(this.uName + ': Error syncing device properites -  ' + _error.message);
      }
   });
};

//§HueLight.prototype.syncDeviceProperty = function(_propName, _propValue) {

   //var f = { brightness: "setLightBrightness", hue: "setLightHue",
             //saturation: "setLightSaturation" };

   //if (f[_propName]) {

      //this.hueService[f[_propName]].call(this.hueService, this.deviceId, _propValue, (_error, _content) => {

         //if (_error) {
            //console.error(this.uName + ': Error turning room off ' + _error.message);
         //}
      //});
   //}
//};

HueLight.prototype.coldStart = function() {
   Thing.prototype.coldStart.call(this);

   this.statusTimer = setInterval(function(_this) {

      _this.hueService.getLightState(_this.deviceId, function(_error, _lightStatus) {
         //console.log(_this.uName + ": AAAA Lightstate = " + JSON.stringify(_lightStatus));

/*         if (!_error && _lightStatus.state.reachable) {

            if (_this.getProperty("power") != _lightStatus.state.on) {
               _this.alignPropertyValue("power", _lightStatus.state.on);
            }

            if (_this.brightnessSupported) {
               var deviceBrightness = Math.floor(_lightStatus.state.bri * 100 / 255);

               if (deviceBrightness != _this.getProperty("brightness")) {
                  _this.alignPropertyValue("brightness", deviceBrightness);
               }
            }

            if (_this.hueSupported) {
               var deviceHue = Math.floor(_lightStatus.state.hue * 360 / 65535);

               if (deviceHue != _this.getProperty("hue")) {
                  _this.alignPropertyValue("hue", deviceHue);
               }
            }

            if (_this.saturationSupported) {
               var deviceSaturation = Math.floor(_lightStatus.state.sat * 100 / 255);

               if (deviceSaturation != _this.getProperty("saturation")) {
                  _this.alignPropertyValue("saturation", deviceSaturation);
               }
            }
         } */
      });
   }, 60000, this);
};

module.exports = exports = HueLight;
