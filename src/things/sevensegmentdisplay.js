var util = require('util');
var Thing = require('../thing');
var SevenSegment = require('ht16k33-sevensegment-display');

function SevenSegmentDisplay(_config, _parent) {
   Thing.call(this, _config, _parent);
   this.display = new SevenSegment(0x70, 1);

   this.ensurePropertyExists('digit-0', 'property', { initialValue: 0 }, _config);
   this.ensurePropertyExists('digit-1', 'property', { initialValue: 0 }, _config);
   this.ensurePropertyExists('digit-2', 'property', { initialValue: 0 }, _config);
   this.ensurePropertyExists('digit-3', 'property', { initialValue: 0 }, _config);
   this.ensurePropertyExists('minutes', 'property', { initialValue: 0 }, _config);
   this.ensurePropertyExists('hours', 'property', { initialValue: 0 }, _config);
   this.ensurePropertyExists('point-0', 'property', { initialValue: 0 }, _config);
   this.ensurePropertyExists('point-1', 'property', { initialValue: 0 }, _config);
   this.ensurePropertyExists('point-2', 'property', { initialValue: 0 }, _config);
   this.ensurePropertyExists('point-3', 'property', { initialValue: 0 }, _config);
   this.ensurePropertyExists('colon', 'property', { initialValue: false }, _config);
}

util.inherits(SevenSegmentDisplay, Thing);

SevenSegmentDisplay.prototype.propertyAboutToChange = function(_propName, _propValue, _data) {

   switch (_propName) {

      case "digit-0":
         this.display.writeDigit(4, _propValue);
         break;

      case "digit-1":
         this.display.writeDigit(3, _propValue);
         break;

      case "digit-2":
         this.display.writeDigit(1, _propValue);
         break;

      case "digit-3":
         this.display.writeDigit(0, _propValue);
         break;

      case "minutes":
         console.log(this.uName+": AAAAAA ");
         this.display.writeDigit(4, _propValue % 10);
         this.display.writeDigit(3, Math.floor(_propValue / 10));
         break;

      case "hours":
         this.display.writeDigit(1, _propValue % 10);
         this.display.writeDigit(0, Math.floor(_propValue / 10));
         break;

      case "colon":
         this.display.writeDigit(2, _propValue ? 1 : 0);
         break;
   }
};

module.exports = exports = SevenSegmentDisplay;
