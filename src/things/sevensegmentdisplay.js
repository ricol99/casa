var util = require('util');
var Thing = require('../thing');
var SevenSegment = require('ht16k33-sevensegment-display');

function SevenSegmentDisplay(_config, _parent) {

   if (_config.hasOwnProperty("events")) {
      _config.events.push({ "name": "minute-changed", "rule": "* * * * *" });
   }
   else {
      _config.events = [{ "name": "minute-changed", "rule": "* * * * *" }];
   }

   Thing.call(this, _config, _parent);

   this.resolution = _config.hasOwnProperty("resolution") ? _config.resolution : "none";
   this.display = new SevenSegment(0x70, 1);

   this.ensurePropertyExists('digit-0', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('digit-1', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('digit-2', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('digit-3', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('point-0', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('point-1', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('point-2', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('point-3', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('colon', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('display-clock', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('resolution', 'property', { initialValue: "minutes" }, _config);

   this.now  = { year: 0, month: 0, day: 0, hours: 0, minutes: 0, seconds: 0 };
   this.tick = true;
}

util.inherits(SevenSegmentDisplay, Thing);

SevenSegmentDisplay.prototype.coldStart = function() {

   if (this.getProperty("display-clock")) {
      this.startDisplayingClock();
   }
   Thing.prototype.coldStart.call(this);
};

SevenSegmentDisplay.prototype.startDisplayingClock = function(_resolution) {
   this.displayingClock = true;
   let res = _resolution ? _resolution : this.getProperty("resolution");
   this.updateClock();

   if (res === "seconds") {
      this.secondTimerRequired = true;
      this.startSecondTimer();
   }
   else if (this.secondTimerRequired) {
      this.secondTimerRequired = false;
      clearTimeout(this.secondTimer);
      this.display.writeDigit(2, 1);
   }
};

SevenSegmentDisplay.prototype.stopDisplayingClock = function() {
   this.displayingClock = false;

   if (res === "seconds") {
      this.secondTimerRequired = false;
      clearTimeout(this.secondTimer);
   }

   this.updateDisplayFromProperties();
};

SevenSegmentDisplay.prototype.updateDisplayFromProperties = function() {
   this.display.writeDigit(4, this.getProperty("digit-0"));
   this.display.writeDigit(3, this.getProperty("digit-1"));
   this.display.writeDigit(1, this.getProperty("digit-2"));
   this.display.writeDigit(0, this.getProperty("digit-3"));
   this.display.writeDigit(2, this.getProperty("colon") ? 1 : false);
};

SevenSegmentDisplay.prototype.updateClock = function() {
   let d = new Date();
   this.now.seconds = d.getSeconds();
   this.now.minutes = d.getMinutes();
   this.now.hours = d.getHours();

   this.updateProperty('digit-0', this.now.minutes % 10);
   this.updateProperty('digit-1', Math.floor(this.now.minutes / 10));
   this.updateProperty('digit-2', this.now.hours % 10);
   this.updateProperty('digit-3', Math.floor(this.now.hours / 10));

   if (this.getProperty("resolution") === "seconds") {
      this.display.writeDigit(2, (this.now.seconds % 2) > 0 ? 1 : false);
   }
};

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

      case "resolution":
         if (this.getProperty("display-clock")) {
            this.startDisplayingClock(_propValue);
         }
         break;

      case "display-clock":
         if (_propValue) {
            this.startDisplayingClock();
         }
         else {
            this.stopDisplayingClock();
         }
         break;
   }
};

SevenSegmentDisplay.prototype.eventAboutToBeRaised = function(_eventName, _data) {

   if ((_eventName === "minute-changed") && this.displayingClock) {
      this.updateClock();
   }
};

SevenSegmentDisplay.prototype.startSecondTimer = function() {
   
   if (this.secondTimerRequired) {
      let now = Date.now() % 1000;
      let delta = 1000 - now;

      this.secondTimer = setTimeout( () => {
         this.startSecondTimer();
         this.display.writeDigit(2, this.tick ? 1 : false);
         this.tick = !this.tick;
      }, delta);
   }
};

module.exports = exports = SevenSegmentDisplay;
