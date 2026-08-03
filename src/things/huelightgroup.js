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

   this.ensurePropertyExists('power', 'serviceproperty', { valueType: "boolean", initialValue: false, id: this.lightGroupId, serviceType: "lightgroup", serviceName: this.serviceName, sync: "write" }, _config);
   this.brightnessSupported = _config.hasOwnProperty("brightnessSupported") ? _config.brightnessSupported : true;

   if (this.brightnessSupported)  {
      this.ensurePropertyExists('brightness', 'serviceproperty', { valueType: "number", initialValue: 100, id: this.lightGroupId, serviceType: "lightgroup", serviceName: this.serviceName, sync: "write" }, _config);
   }

   if (_config.hasOwnProperty("hueSupported")) {

      if (_config.hueSupported) {
         this.hueSupported = true;
         this.ensurePropertyExists('hue', 'serviceproperty', { valueType: "number", initialValue: 360, id: this.lightGroupId, serviceType: "lightgroup", serviceName: this.serviceName, sync: "write" }, _config);
      }

      if (_config.saturationSupported) {
         this.saturationSupported = true;
         this.ensurePropertyExists('saturation', 'serviceproperty', { valueType: "number", initialValue: 100, id: this.lightGroupId, serviceType: "lightgroup", serviceName: this.serviceName, sync: "write" }, _config);
      }
   }
   else if (_config.colourTempSupported) {
      this.colourTempSupported = true;
      this.ensurePropertyExists('colour-temp', 'serviceproperty', { valueType: "number", initialValue: 153, id: this.lightGroupId, serviceType: "lightgroup", serviceName: this.serviceName, sync: "write" }, _config);
   }

   this.ensurePropertyExists('scene', 'property', { valueType: "string", initialValue: false }, _config);
}

util.inherits(HueLightGroup, Thing);

// Called when current state required
HueLightGroup.prototype.export = function(_exportObj) {
   Thing.prototype.export.call(this, _exportObj);
};

// Called when current state required
HueLightGroup.prototype.import = function(_importObj) {
   Thing.prototype.import.call(this, _importObj);
};

HueLightGroup.prototype.coldStart = function() { 
   Thing.prototype.coldStart.call(this);
};

HueLightGroup.prototype.hotStart = function() {
   Thing.prototype.hotStart.call(this);
};

module.exports = exports = HueLightGroup;
