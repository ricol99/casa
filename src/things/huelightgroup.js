var util = require('util');
var Thing = require('../thing');

function HueLightGroup(_config) {
   Thing.call(this, _config);
   this.thingType = "hue-light-group";
   this.displayName = _config.displayName;

   if (_config.hasOwnProperty('lightGroupId')) {
      this.lightGroupId = _config.lightGroupId;
   }
   else if (_config.hasOwnProperty('hueGroupName')) {
      this.hueGroupName = _config.hueGroupName;
   }

   this.ensurePropertyExists('power', 'property', { initialValue: false }, _config);

   this.hueService =  this.casa.findService("hueservice");

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

   this.ensurePropertyExists('scene', 'property', { initialValue: false }, _config);
}

util.inherits(HueLightGroup, Thing);

HueLightGroup.prototype.propertyAboutToChange = function(_propName, _propValue, _data) {

   if (!_data.coldStart) {

      if (_propName == "power") {

         if (_propValue) {
            this.hueService.setLightGroupState(this.lightGroupId, { power: true });
            this.syncDeviceProperties();
         }
         else {
            this.hueService.setLightGroupState(this.lightGroupId, { power: false });
         }
      }
      else if ((_propName == "scene") && (_propValue != "CLEARED")) {
         this.hueService.setScene(_propValue);
         this.alignPropertyValue(_propName, "CLEARED");
      }
      else if (this.getProperty("power")) {
         this.syncDeviceProperty(_propName, _propValue);
      }
   }
};

HueLightGroup.prototype.syncDeviceProperties = function() {
   var config = { power: true };

   if (this.brightnessSupported) {
      config["brightness"] =  this.getProperty("brightness");
   }

   if (this.hueSupported) {
      config["hue"] =  this.getProperty("hue");
   }

   if (this.saturationSupported)  { 
       config["saturation"] =  this.getProperty("saturation");
   }
   
   this.hueService.setLightGroupState(this.lightGroupId, config);
};

HueLightGroup.prototype.syncDeviceProperty = function(_propName, _propValue) {

   var temp = { power: true };
   temp[_propName] = _propValue;

   switch (_propName) {
      case  "brightness":
      case  "hue":
      case  "saturation":
         this.hueService.setLightGroupState(this.lightGroupId, temp);
         break;
   }
};

HueLightGroup.prototype.coldStart = function() {

   if (this.hueGroupName) {

      this.hueService.getLightGroups( (_err, _result) => {

         if (_err) {
            console.error(this.uName + ": Unable to find room on Hue Bridge!");
         }
         else {
            for (var i = 0; i < _result.length; ++i) {
               var check = (this.groupType) ? (_result[i].type === this.groupType) : true;

               if (check && (_result[i].name === this.hueGroupName)) {
                  this.lightGroupId = _result[i].id;
                  break;
               }
            }

            if (!this.hasOwnProperty('lightGroupId')) {
               console.error(this.uName + ": Unable to find room on Hue Bridge!");
            }
            Thing.prototype.coldStart.call(this);
         }
      });
   }
   else {
      Thing.prototype.coldStart.call(this);
   }
};


module.exports = exports = HueLightGroup;
