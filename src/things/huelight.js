var util = require('util');
var Thing = require('../thing');
var CasaSystem = require('../casasystem');

function HueLight(_config) {
   this.casaSys = CasaSystem.mainInstance();

   Thing.call(this, _config);
   this.thingType = "hue-light";
   this.propsSynced = { brightness: false, hue: false, saturation: false };

   this.deviceID = _config.deviceID;
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

   var that = this;

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
      this.hueService.getLightCapability(this.deviceID, function(_err, _result) {

         if (_err) {
            console.error(that.uName + ": Not able to find hue light id=", that.deviceID);
            return;
         }

         if (_result.hue) {
            that.hueSupported = true;
            that.ensurePropertyExists('hue', 'property', { initialValue: 360 }, _config);
         }

         if (_result.saturation) {
            that.saturationSupported = true;
            that.ensurePropertyExists('saturation', 'property', { initialValue: 100 }, _config);
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

   if (!_data.coldStart) {

      if (_propName == "power") {

         if (_propValue) {
            this.hueService.setLightState(this.deviceID, { power: true, brightness: this.getProperty("brightness"),
                                                           hue: this.getProperty("hue"), saturation: this.getProperty("saturation") }, 
                                                           function(_error, _content) {

               if (_error) {
                  console.log(that.uName + ': Error turning room off ' + _error.message);
               }
               else {
                  that.propsSynced.brightness = true;
                  that.propsSynced.hue = true;
                  that.propsSynced.saturation = true;
               }
            });
         }
         else {
            this.hueService.turnLightOff(this.deviceID, function(_error, _content) {

               if (_error) {
                  console.log(that.uName + ': Error turning room off ' + _error.message);
               }
            });
         }
      }
      else if (this.getProperty("power")) {
         this.syncDeviceProperty(_propName);
      }
      else {
         this.propsSynced[_propName] = false;
      }
   }
};

HueLight.prototype.syncDeviceProperties = function() {

   for (var prop in this.propsSynced) {

      if (this.propsSynced.hasOwnProperty(prop) && !this.propsSynced[prop]) {
         this.syncDeviceProperty(prop);
      }
   }
};

HueLight.prototype.syncDeviceProperty = function(_propName) {
   var that = this;

   if (_propName == "brightness") {
      this.hueService.setLightBrightness(this.deviceID, this.getProperty("brightness"), function(_error, _content) {

         if (_error) {
            console.log(that.uName + ': Error turning room off ' + _error.message);
         }
         else {
            that.propsSynced.brightness = true;
         }
      });
   }
   else if (_propName == "hue") {
      this.hueService.setLightHue(this.deviceID, this.getProperty("hue"), function(_error, _content) {

         if (_error) {
            console.log(that.uName + ': Error turning room off ' + _error.message);
         }
         else {
            that.propsSynced.hue = true;
         }
      });
   }
   else if (_propName == "saturation") {
      this.hueService.setLightSaturation(this.deviceID, this.getProperty("saturation"), function(_error, _content) {

         if (_error) {
            console.log(that.uName + ': Error turning room off ' + _error.message);
         }
         else {
            that.propsSynced.saturation = true;
         }
      });
   }
};

HueLight.prototype.coldStart = function() {
   Thing.prototype.coldStart.call(this);

   this.statusTimer = setInterval(function(_this) {

      _this.hueService.getLightState(_this.deviceID, function(_error, _lightStatus) {
         console.log(_this.uName + ": AAAA Lightstate = " + JSON.stringify(_lightStatus));

/*         if (!_error && _lightStatus.state.reachable) {

            if (_this.getProperty("power") != _lightStatus.state.on) {
               _this.updateProperty("power", _lightStatus.state.on);
            }

            if (_this.brightnessSupported) {
               var deviceBrightness = Math.floor(_lightStatus.state.bri * 100 / 255);

               if (deviceBrightness != _this.getProperty("brightness")) {
                  _this.updateProperty("brightness", deviceBrightness);
               }
            }

            if (_this.hueSupported) {
               var deviceHue = Math.floor(_lightStatus.state.hue * 360 / 65535);

               if (deviceHue != _this.getProperty("hue")) {
                  _this.updateProperty("hue", deviceHue);
               }
            }

            if (_this.saturationSupported) {
               var deviceSaturation = Math.floor(_lightStatus.state.sat * 100 / 255);

               if (deviceSaturation != _this.getProperty("saturation")) {
                  _this.updateProperty("saturation", deviceSaturation);
               }
            }
         } */
      });
   }, 60000, this);
};

module.exports = exports = HueLight;
