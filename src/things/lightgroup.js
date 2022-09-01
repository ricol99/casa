var util = require('util');
var Thing = require('../thing');

function LightGroup(_config, _parent) {
   Thing.call(this, _config, _parent);
   this.thingType = "light-group";
   this.displayName = _config.displayName;

   this.ensurePropertyExists('power', 'property', { initialValue: false }, _config);
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
   else if (_config.colourTempSupported) {
      this.colourTempSupported = true;
      this.ensurePropertyExists('colour-temp', 'property', { initialValue: 153 }, _config);
   }

   this.ensurePropertyExists('scene', 'property', { initialValue: false }, _config);
}

util.inherits(LightGroup, Thing);

// Called when current state required
LightGroup.prototype.export = function(_exportObj) {
   Thing.prototype.export.call(this, _exportObj);
};

// Called when current state required
LightGroup.prototype.import = function(_importObj) {
   Thing.prototype.import.call(this, _importObj);
};

LightGroup.prototype.coldStart = function() { 
   Thing.prototype.coldStart.call(this);
};

LightGroup.prototype.hotStart = function() {
   Thing.prototype.hotStart.call(this);
};

module.exports = exports = LightGroup;
