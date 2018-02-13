var util = require('util');
var schedule = require('node-schedule');
var SunCalc = require('suncalc');
var Parser = require('cron-parser');
var Service = require('../service');
var CasaSystem = require('../casasystem');

function ScheduleService(_config) {
   Service.call(this, _config);

   // Defaults to London
   this.latitude = (_config.hasOwnProperty("latitude")) ? _config.latitude : 51.5;
   this.longitude = (_config.hasOwnProperty("longitude")) ? _config.longitude : -0.1;

   this.refreshScheduler = new RefreshScheduler(this);
   this.schedules = [];
}

util.inherits(ScheduleService, Service);

ScheduleService.prototype.registerEvents = function(_owner, _config) {
   var sched = new Schedule(_owner, _config, this);
   this.schedules.push(sched);
   return sched.getInitialValue();
};

ScheduleService.prototype.getSunTimes = function() {

   if (!this.sunTimes) {
      this.sunTimes = SunCalc.getTimes(new Date(), this.latitude, this.longitude);
   }

   return this.sunTimes;
};

ScheduleService.prototype.refreshSunEvents = function() {
   this.sunTimes = SunCalc.getTimes(new Date(), this.latitude, this.longitude);

   for (var index = 0; index < this.schedules.length; ++index) {
      this.schedules[index].refreshSunEvents(this.sunTimes);
   }
};

ScheduleService.prototype.coldStart = function() {
};

function Schedule(_owner, _config, _service) {
   this.uName = _service.uName + ":" + _owner.uName;
   this.service = _service;
   this.events = [];

   this.createEventsFromConfig(_owner, _config);
   this.scheduleEvents();
};

Schedule.prototype.createEventsFromConfig = function(_owner, _eventsConfig) {
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

      if (_eventsConfig[index].hasOwnProperty("value")) {
         this.events.push({ name: _eventsConfig[index].name, rule: origEventRule, originalRule: origEventRule, ruleDelta: eventRuleDelta,
                            sunTime: false, job: null, value: _eventsConfig[index].value, owner: _owner });
      }
      else if (_eventsConfig[index].hasOwnProperty("ramp")) {
         this.events.push({ name: _eventsConfig[index].name, rule: origEventRule, originalRule: origEventRule, ruleDelta: eventRuleDelta,
                            sunTime: false, job: null, ramp: _eventsConfig[index].ramp, owner: _owner });
      }
      else {
         this.events.push({ name: _eventsConfig[index].name, rule: origEventRule, originalRule: origEventRule, ruleDelta: eventRuleDelta,
                            sunTime: false, job: null, owner: _owner });
      }
   }
}

Schedule.prototype.lastEventScheduledBeforeNow = function(_now, _event) {

   var startDate = new Date();
   startDate.setTime(startDate.getTime()-(_now.getHours()*60*60*1000)-(_now.getSeconds()*60*1000));

   var options = {
      currentDate: startDate,
      endDate: _now,
      iterator: true
   };
   var lastScheduled = null;

   try {
      var interval = Parser.parseExpression(_event.rule, options);
      do {
         try {
            lastScheduled = interval.next();
         } catch (e) {
            break;
         }
      } while (!lastScheduled.done);

    } catch (err) {
       // Not scheduled during time period
       console.log(this.uName + ': Error: ' + err.message);
    }

    return (lastScheduled) ? lastScheduled.value : null;
};

// Returns null if it is not closer or the new closestSchedule
Schedule.prototype.determineClosestEvent = function(_now, _currentClosestEventSchedule, _event) {

   var lastScheduled = (_event.sunTime) ? _event.rule : this.lastEventScheduledBeforeNow(_now, _event);

   if (lastScheduled && lastScheduled < _now) {

      if (_currentClosestEventSchedule) {
         var currentClosestDelta = _now.getTime() - _currentClosestEventSchedule.getTime();
         var delta = _now.getTime() - lastScheduled.getTime();

         return (delta < currentClosestDelta) ? lastScheduled : null;
      }
      else {
         return lastScheduled;
      }
   }
   else {
      return null;
   }
};

Schedule.prototype.scheduleAllJobs = function() {
   this.setSunTimes(this.service.getSunTimes());

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

Schedule.prototype.refreshSunEvents = function(_sunTimes) {
   this.setSunTimes(_sunTimes);

   for (var index = 0; index < this.events.length; ++index) {

      if (this.events[index].sunTime && (this.events[index].rule > new Date())) {
         this.resetJob(this.events[index]);
      }
   }
}

Schedule.prototype.setSunTimes = function(_sunTimes) {
   var result = false;
   var eventsLen = this.events.length;

   for (var index = 0; index < eventsLen; ++index) {

      if ((typeof this.events[index].originalRule == 'string') && _sunTimes[this.events[index].originalRule]) {
         console.log(this.uName + ': Rule ' + this.events[index].originalRule + ' is a sun time');
         this.events[index].rule = new Date(_sunTimes[this.events[index].originalRule]);
         this.events[index].rule.setTime(this.events[index].rule.getTime() + (this.events[index].ruleDelta * 1000));
         this.events[index].sunTime = true;
         console.log(this.uName + ': Sun time ' + this.events[index].originalRule + ' for start of schedule. Actual scheduled time is ' + this.events[index].rule);
      }
   }
}

Schedule.prototype.resetJob = function(_event) {
   
   if (_event.job) {
     _event.job.cancel();
   }

   _event.job = schedule.scheduleJob(_event.rule, function() {
      // this = _event.job
      this.myEvent.owner.scheduledEventTriggered(this.myEvent);
   });

   if (_event.job) {
      _event.job.myEvent = _event;
      _event.job.mySchedule = this;
   }
   else {
      console.error(this.uName + ": Unable to schedule rule '" + _event.rule +"' for owner " + _event.owner.uName);
      process.exit(1);
   }
}

Schedule.prototype.scheduleEvents = function() {
   this.scheduleAllJobs();
};

Schedule.prototype.getInitialValue = function() {
   var closestEvent = null;
   var closestEventSchedule = null;
   var now = new Date();

   for (var index = 0; index < this.events.length; ++index) {
      var tempClosestSchedule = this.determineClosestEvent(now, closestEventSchedule, this.events[index]);

      if (tempClosestSchedule) {
         closestEvent = this.events[index];
         closestEventSchedule = new Date(tempClosestSchedule);
      }
   }

   if (!closestEvent) {
      closestEvent = this.events[this.events.length-1];
   }

   console.log(this.uName + ": Closest event is " + closestEvent.rule);

   if (closestEvent.hasOwnProperty("ramp")) {

      if (closestEvent.ramp.hasOwnProperty("ramps")) {
         return closestEvent.ramp.ramps[closestEvent.ramp.ramps.length-1].endValue;
      }
      else {
         return closestEvent.ramp.endValue;
      }
   }
   else {
      return closestEvent.value;
   }
};

function RefreshScheduler(_schedulerService) {
   this.schedulerService = _schedulerService;

   var refreshJob = schedule.scheduleJob('10 1 * * *', () => {
      this.schedulerService.refreshSunEvents();
   });
}

function copyObject(_sourceObject) {
   var newObject = {};

   for (var prop in _sourceObject) {

      if (_sourceObject.hasOwnProperty(prop)){
         newObject[prop] = _sourceObject[prop];
      }
   }

   return newObject;
}

module.exports = exports = ScheduleService;
 
