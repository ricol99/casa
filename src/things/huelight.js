var util = require('util');
var Thing = require('../thing');

function HueLight(_config, _parent) {
   Thing.call(this, _config, _parent);
   this.thingType = "hue-light";
   this.displayName = _config.displayName;
   this.deviceId = _config.deviceId;
   this.service = (_config.hasOwnProperty("service")) ? _config.service : "hueservice";

   this.ensurePropertyExists('power', 'property', { initialValue: false }, _config);
   this.hueServiceName =  this.casa.findServiceName(this.service);

   if (!this.hueServiceName) {
      console.error(this.uName + ": ***** Hue service not found! *************");
      process.exit();
   }

   var serviceProps = [ "power" ];
   this.brightnessSupported = _config.hasOwnProperty("brightnessSupported") ? _config.brightnessSupported : true;

   if (this.brightnessSupported)  {
      serviceProps.push("brightness");
      this.ensurePropertyExists('brightness', 'property', { initialValue: 100 }, _config);
   }

   if (_config.hasOwnProperty("hueSupported")) {

      if (_config.hueSupported) {
         this.hueSupported = true;
         serviceProps.push("hue");
         this.ensurePropertyExists('hue', 'property', { initialValue: 360 }, _config);
      }

      if (_config.saturationSupported) {
         this.saturationSupported = true;
         serviceProps.push("saturation");
         this.ensurePropertyExists('saturation', 'property', { initialValue: 100 }, _config);
      }
   }
   else if (_config.colourTempSupported) {
      this.colourTempSupported = true;
      serviceProps.push("colour-temp");
      this.ensurePropertyExists('colour-temp', 'property', { initialValue: 153 }, _config);
   }

   this.ensurePropertyExists('hub-connected', 'property', { initialValue: false, source: { uName: this.hueServiceName, property: "hub-connected", 
                                                            subscription: { subscriber: this.uName, type: "light", id: this.deviceId, subscriberProperties: serviceProps } }}, _config);
}

util.inherits(HueLight, Thing);

module.exports = exports = HueLight;
