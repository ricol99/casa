var util = require('util');
var Thing = require('../thing');

function HueLightGroup(_config, _parent) {
   Thing.call(this, _config, _parent);
   this.lightGroupId = _config.lightGroupId;
   this.thingType = "hue-light-group";
   this.displayName = _config.displayName;
   this.serviceName = (_config.hasOwnProperty("serviceName")) ? _config.serviceName :  this.gang.casa.findServiceName("hueservice");

   if (!this.serviceName) {
      console.error(this.uName + ": ***** Hue service not found! *************");
      process.exit();
   }

   this.ensurePropertyExists('power', 'serviceproperty', { initialValue: false, id: this.lightGroupId, serviceType: "lightgroup", serviceName: this.serviceName, sync: "write" }, _config);
   this.brightnessSupported = _config.hasOwnProperty("brightnessSupported") ? _config.brightnessSupported : true;

   if (this.brightnessSupported)  {
      this.ensurePropertyExists('brightness', 'serviceproperty', { initialValue: 100, id: this.lightGroupId, serviceType: "lightgroup", serviceName: this.serviceName, sync: "write" }, _config);
   }

   if (_config.hasOwnProperty("hueSupported")) {

      if (_config.hueSupported) {
         this.hueSupported = true;
         this.ensurePropertyExists('hue', 'serviceproperty', { initialValue: 360, id: this.lightGroupId, serviceType: "lightgroup", serviceName: this.serviceName, sync: "write" }, _config);
      }

      if (_config.saturationSupported) {
         this.saturationSupported = true;
         this.ensurePropertyExists('saturation', 'serviceproperty', { initialValue: 100, id: this.lightGroupId, serviceType: "lightgroup", serviceName: this.serviceName, sync: "write" }, _config);
      }
   }
   else if (_config.colourTempSupported) {
      this.colourTempSupported = true;
      this.ensurePropertyExists('colour-temp', 'serviceproperty', { initialValue: 153, id: this.lightGroupId, serviceType: "lightgroup", serviceName: this.serviceName, sync: "write" }, _config);
   }

   this.ensurePropertyExists('scene', 'property', { initialValue: false }, _config);
}

util.inherits(HueLightGroup, Thing);

module.exports = exports = HueLightGroup;
