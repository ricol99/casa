var util = require('util');
var Thing = require('../thing');

function HueLightGroup(_config, _parent) {
   Thing.call(this, _config, _parent);
   this.thingType = "hue-light-group";
   this.displayName = _config.displayName;
   this.service = (_config.hasOwnProperty("service")) ? _config.service : "hueservice";

   if (_config.hasOwnProperty('lightGroupId')) {
      this.lightGroupId = _config.lightGroupId;
   }
   else if (_config.hasOwnProperty('hueGroupName')) {
      this.hueGroupName = _config.hueGroupName;
   }

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

   this.ensurePropertyExists('scene', 'property', { initialValue: false }, _config);

   if (_config.hasOwnProperty('lightGroupId')) {
      this.ensurePropertyExists('hub-connected', 'property', { initialValue: false, source: { uName: this.hueServiceName, property: "hub-connected",
                                                               subscription: { subscriber: this.uName, type: "lightgroup", id: this.lightGroupId, subscriberProperties: serviceProps } }}, _config);
   }
   else {
      this.ensurePropertyExists('hub-connected', 'property', { initialValue: false, source: { uName: this.hueServiceName, property: "hub-connected",
                                                               subscription: { subscriber: this.uName, type: "lightgroup", id: this.hueGroupName, subscriberProperties: serviceProps } }}, _config);
   }
}

util.inherits(HueLightGroup, Thing);

module.exports = exports = HueLightGroup;
