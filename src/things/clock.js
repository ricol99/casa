var util = require('util');
var Thing = require('../thing');

function Clock(_config, _parent) {

   if (_config.hasOwnProperty("events")) {
      _config.events.push({ "name": "minute-changed", "rule": "* * * * *" });
   }
   else {
      _config.events = [{ "name": "minute-changed", "rule": "* * * * *" }];
   }

   Thing.call(this, _config, _parent);

   this.ensurePropertyExists('seconds', 'property', { initialValue: 0 }, _config);
   this.ensurePropertyExists('minutes', 'property', { initialValue: 0 }, _config);
   this.ensurePropertyExists('hours', 'property', { initialValue: 0 }, _config);
   this.ensurePropertyExists('day', 'property', { initialValue: 0 }, _config);
   this.ensurePropertyExists('month', 'property', { initialValue: 0 }, _config);
   this.ensurePropertyExists('year', 'property', { initialValue: 0 }, _config);

   this.resolution = "none";
}

util.inherits(Clock, Thing);

Clock.prototype.coldStart = function() {
   this.updateAllProperties();
   Thing.prototype.coldStart.call(this);
};

Clock.prototype.updateAllProperties = function() {
   let now = this.now();
   let args = { year: true, month: true, day: true, hours: true, minutes: true, seconds: true };

   for (arg in args) {
      this.updateProperty(arg, now[arg]);
   }
};

Clock.prototype.now = function() {
   let d = new Date();
   var now = {};

   now.seconds = d.getSeconds();
   now.minutes = d.getMinutes();
   now.hours = d.getHours();
   now.day = d.getDate();
   now.month = d.getMonth() + 1;
   now.year = d.getFullYear();

   return now;
};

Clock.prototype.propertySubscribedTo = function(_property, _subscription, _exists) {

   let pri = { none: 0, year: 1, month: 2, day: 3, hours: 4, minutes: 5, seconds: 6 };

   if (pri.hasOwnProperty(_property)) {

      if (pri[_property] > pri[this.resolution]) {
         this.resolution = _property;

         if (this.resolution === "seconds") {
            this.secondTimerRequired = true;
            this.startSecondTimer();
         }
      }
   }
};

Clock.prototype.eventAboutToBeRaised = function(_eventName, _data) {

   if (_eventName === "minute-changed") {
      this.updateAllProperties();
   }
};

Clock.prototype.startSecondTimer = function() {

   if (this.secondTimerRequired) {
      let now = Date.now() % 1000;
      let delta = 1000 - now;
      console.log("AAAAAAAAAAAA " + delta);

      this.secondTimer = setTimeout( () => {
         this.startSecondTimer();
         this.updateAllProperties();
      }, delta);
   }
};

module.exports = exports = Clock;
