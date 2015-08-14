var util = require('util');
var PropertyBinder = require('./propertyBinder');
var schedule = require('node-schedule');
var SunCalc = require('suncalc');

var sunScheduler = null;

function SunScheduler() {
   this.states = [];

   var that = this;

   var refreshJob = schedule.scheduleJob('10 1 * * *', function() {
      var len = that.states.length;

      for (var i = 0; i < len; ++i) {
         that.states[i].resetSunJobs();
      }
   });
}

function SchedulePropertyBinder(_config, _source) {

   // Defaults to London
   this.latitude = (_config.latitude) ? _config.latitude : 51.5;
   this.longitude = (_config.longitude) ? _config.longitude : -0.1;

   this.startRuleIsSunTime = false;
   this.endRuleIsSunTime = false;

   PropertyBinder.call(this, _config, _source);

   this.writable = false;
   this.events = [];

   this.createEventsFromConfig(_config.events);

   var that = this;

   if (!sunScheduler) {
      sunScheduler = new SunScheduler();
   }

   sunScheduler.states.push(this);
   this.resetAllJobs();
}

util.inherits(SchedulePropertyBinder, PropertyBinder);

SchedulePropertyBinder.prototype.createEventsFromConfig = function(_eventsConfig) {
   var eventsConfigLen = _eventsConfig.length;

   for (var index = 0; index < eventsConfigLen; ++index) {
      var origEventRule;
      var eventRuleDelta;

      if (typeof _eventsConfig[index].rule == "string") {
         var arr = _eventsConfig[index].rule.split(':');

         if (arr.length == 2) {
            origEventRule = arr[0];
            eventRuleDelta = parseInt(arr[1]);
         }
         else {
            origEventRule = _eventsConfig[index].rule;
            eventRuleDelta = 0;
         }
      }
      else {
         origEventRule = _eventsConfig[index].rule;
         eventRuleDelta = 0;
      }

      this.events[index] = { rule: origEventRule, originalRule: origEventRule, ruleDelta: eventRuleDelta,
                             sunTime: false, job: null, propertyValue: _eventsConfig[index].propertyValue };
   }
}

SchedulePropertyBinder.prototype.resetAllJobs = function() {
   this.setSunTimes();

   for (var index = 0; index < this.events.length; ++index) {

      if (this.events[index].sunTime) {

         if (this.events[index].rule > new Date()) {
            this.resetJob(this.events[index]);
         }
      }
      else {
         this.resetJob(this.events[index]);
      }
   }
}

SchedulePropertyBinder.prototype.resetSunJobs = function() {
   this.setSunTimes();

   for (var index = 0; index < this.events.length; ++index) {

      if (this.events[index].sunTime && (this.events[index].rule > new Date())) {
         this.resetJob(this.events[index]);
      }
   }
}

SchedulePropertyBinder.prototype.setSunTimes = function() {
   var result = false;
   this.times = SunCalc.getTimes(new Date(), this.latitude, this.longitude);
   var eventsLen = this.events.length;

   for (var index = 0; index < eventsLen; ++index) {

      if ((typeof this.events[index].originalRule == 'string') && this.times[this.events[index].originalRule]) {
         console.log(this.name + ': Rule ' + this.events[index].originalRule + ' is a sun time');
         this.events[index].rule = this.times[this.events[index].originalRule];
         this.events[index].rule.setSeconds(this.events[index].rule.getSeconds() + this.events[index].ruleDelta);
         this.events[index].sunTime = true;
         console.log(this.name + ': Sun time ' + this.events[index].originalRule + ' for start of schedule. Actual scheduled time is ' + this.events[index].rule);
      }
   }
}

SchedulePropertyBinder.prototype.resetJob = function(_event) {
   var that = this;
   
   if (_event.job) {
     _event.job.cancel();
   }

   _event.job = schedule.scheduleJob(_event.rule, function() {
      that.updatePropertyAfterRead(_event.propertyValue);
   });
}

module.exports = exports = SchedulePropertyBinder;
 
