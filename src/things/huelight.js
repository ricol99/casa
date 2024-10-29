var util = require('util');
var Thing = require('../thing');

function HueLight(_config, _parent) {
   Thing.call(this, _config, _parent);
   this.thingType = "hue-light";
   this.displayName = _config.displayName;
   this.deviceId = _config.deviceId;
   this.serviceName = (_config.hasOwnProperty("serviceName")) ? _config.serviceName :  this.gang.casa.findServiceName("hueservice");
   this.sync = _config.hasOwnProperty("sync") ? (_config.sync ? "readwrite" : "write") : "write";

   if (!this.serviceName) {
      console.error(this.uName + ": ***** Hue service not found! *************");
      process.exit();
   }

   this.ensurePropertyExists('power', 'serviceproperty', { initialValue: false, id: this.deviceId, serviceType: "light", serviceName: this.serviceName, sync: this.sync }, _config);
   this.brightnessSupported = _config.hasOwnProperty("brightnessSupported") ? _config.brightnessSupported : true;

   if (this.brightnessSupported)  {
      this.ensurePropertyExists('brightness', 'serviceproperty', { initialValue: 100, id: this.deviceId, serviceType: "light", serviceName: this.serviceName, sync: this.sync }, _config);
   }

   if (_config.hasOwnProperty("hueSupported")) {

      if (_config.hueSupported) {
         this.hueSupported = true;
         this.ensurePropertyExists('hue', 'serviceproperty', { initialValue: 360, id: this.deviceId, serviceType: "light", serviceName: this.serviceName, sync: this.sync }, _config);
      }

      if (_config.saturationSupported) {
         this.saturationSupported = true;
         this.ensurePropertyExists('saturation', 'serviceproperty', { initialValue: 100, id: this.deviceId, serviceType: "light", serviceName: this.serviceName, sync: this.sync }, _config);
      }
   }
   else if (_config.colourTempSupported) {
      this.colourTempSupported = true;
      this.ensurePropertyExists('colour-temp', 'serviceproperty', { initialValue: 153, id: this.deviceId, serviceType: "light", serviceName: this.serviceName, sync: this.sync }, _config);
   }
}

util.inherits(HueLight, Thing);

// Called when current state required
HueLight.prototype.export = function(_exportObj) {
   Thing.prototype.export.call(this, _exportObj);
};

// Called when current state required
HueLight.prototype.import = function(_importObj) {
   Thing.prototype.import.call(this, _importObj);
};

HueLight.prototype.coldStart = function() {
   Thing.prototype.coldStart.call(this);
};

HueLight.prototype.hotStart = function() {
   Thing.prototype.hotStart.call(this);
};

module.exports = exports = HueLight;
