var util = require('util');
var Thing = require('../thing');

function Hifi(_config, _parent) {
   Thing.call(this, _config, _parent);

   this.ensurePropertyExists('power-amp-temperature', 'property', { initialValue: 0 }, _config);
   this.ensurePropertyExists('power-amp-cold-temp', 'property', { initialValue: 20 }, _config);
   this.ensurePropertyExists('power-amp-hot-temp', 'property', { initialValue: 35 }, _config);
   this.ensurePropertyExists('shelf-colour', 'property', { initialValue: 0 }, _config);
   this.ensurePropertyExists('shelf-cold-hue', 'property', { initialValue: 0 }, _config);
   this.ensurePropertyExists('shelf-hot-hue', 'property', { initialValue: 0 }, _config);
}

util.inherits(Hifi, Thing);

Hifi.prototype.propertyAboutToChange = function(_propName, _propValue, _data) {

   if (!_data.coldStart) {

      if (_propName === "power-amp-temperature") {
         var coldTemp = this.getProperty("power-amp-cold-temp");
         var hotTemp = this.getProperty("power-amp-hot-temp");
         var coldHue = this.getProperty("shelf-cold-hue");
         var hotHue = this.getProperty("shelf-hot-hue");

         if ((_propValue >= coldTemp) && (_propValue <= hotTemp)) {
            this.alignPropertyValue("shelf-colour", Math.floor((((_propValue - coldTemp) / (hotTemp - coldTemp)) * (hotHue - coldHue)) + coldHue));
         }
      }
   }
};

module.exports = exports = Hifi;
