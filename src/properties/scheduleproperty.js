var util = require('util');
var Property = require('../property');
var schedule = require('node-schedule');
var SunCalc = require('suncalc');
var Forecast = require('forecast.io');
var Parser = require('cron-parser');
var CasaSystem = require('../casasystem');

function ScheduleProperty(_config, _owner) {

   Property.call(this, _config, _owner);

   var casaSys = CasaSystem.mainInstance();
   this.scheduleService = casaSys.findService("scheduleservice");

   if (!this.scheduleService) {
      console.error(this.uName + ": ***** Schedule service not found! *************");
      process.exit(1);
   }

   this.writable = false;
   this.events = [];
   this.ramps = {};

   var val = this.scheduleService.registerEvents(this, _config.events);

   if (_config.events.length > 1) {
      this.value = val;
   }
}

util.inherits(ScheduleProperty, Property);

ScheduleProperty.prototype.scheduledEventTriggered = function(_event) {

   if (_event.hasOwnProperty("value")) {
      this.updatePropertyInternal(_event.value, { sourceName: this.owner.uName });
   }
   else {
      this.setWithRamp(_event.ramp, { sourceName: this.owner.uName });
   }
}

ScheduleProperty.prototype.getRampStartValue = function(_event) {
   return this.rawPropertyValue;
}

ScheduleProperty.prototype.set = function(_propValue, _data) {
   console.log(this.uName + ': Not allowed to set property ' + this.name + ' to ' + _propValue);
   return false;
}

module.exports = exports = ScheduleProperty;
 
