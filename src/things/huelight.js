var util = require('util');
var Thing = require('../thing');

function HueLight(_config, _parent) {
   Thing.call(this, _config, _parent);
   this.thingType = "hue-light";
   this.displayName = _config.displayName;
   this.deviceId = _config.deviceId;
   this.service = (_config.hasOwnProperty("service")) ? _config.service : "hueservice";

   this.hueServiceName =  this.casa.findServiceName(this.service);

   if (!this.hueServiceName) {
      console.error(this.uName + ": ***** Hue service not found! *************");
      process.exit();
   }

   this.ensurePropertyExists('power', 'serviceproperty', { initialValue: false, id: this.deviceId, serviceType: "light", serviceName: this.service, sync: "write" }, _config);
   this.brightnessSupported = _config.hasOwnProperty("brightnessSupported") ? _config.brightnessSupported : true;

   if (this.brightnessSupported)  {
      this.ensurePropertyExists('brightness', 'serviceproperty', { initialValue: 100, id: this.deviceId, serviceType: "light", serviceName: this.service, sync: "write" }, _config);
   }

   if (_config.hasOwnProperty("hueSupported")) {

      if (_config.hueSupported) {
         this.hueSupported = true;
         this.ensurePropertyExists('hue', 'serviceproperty', { initialValue: 360, id: this.deviceId, serviceType: "light", serviceName: this.service, sync: "write" }, _config);
      }

      if (_config.saturationSupported) {
         this.saturationSupported = true;
         this.ensurePropertyExists('saturation', 'serviceproperty', { initialValue: 100, id: this.deviceId, serviceType: "light", serviceName: this.service, sync: "write" }, _config);
      }
   }
   else if (_config.colourTempSupported) {
      this.colourTempSupported = true;
      this.ensurePropertyExists('colour-temp', 'serviceproperty', { initialValue: 153, id: this.deviceId, serviceType: "light", serviceName: this.service, sync: "write" }, _config);
   }
}

util.inherits(HueLight, Thing);

module.exports = exports = HueLight;
