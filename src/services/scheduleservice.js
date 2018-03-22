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
   this.schedules = {};
}

util.inherits(ScheduleService, Service);

ScheduleService.prototype.registerEvents = function(_owner, _config) {
   var sched = new Schedule(_owner, _config, this);
   this.schedules[_owner.uName] = sched;
   return sched.getInitialValue();
};

ScheduleService.prototype.addEvent = function(_owner, _event) {

   if (!this.schedules.hasOwnProperty(_owner.uName)) {
      this.registerEvents(_owner, [ _event ]);
   }
   else {
      this.schedules[_owner.uName].addEvent(_event);
   }
};

ScheduleService.prototype.removeEvent = function(_owner, _eventName) {

   if (!this.schedules.hasOwnProperty(_owner.uName)) {
      return false;
   }

   return this.schedules[_owner.uName].removeEvent(_eventName);
};

ScheduleService.prototype.getSunTimes = function() {

   if (!this.sunTimes) {
      this.sunTimes = SunCalc.getTimes(new Date(), this.latitude, this.longitude);
   }

   return this.sunTimes;
};

ScheduleService.prototype.refreshSunEvents = function() {
   this.sunTimes = SunCalc.getTimes(new Date(), this.latitude, this.longitude);

   for (var index in this.schedules) {

      if (this.schedules.hasOwnProperty(index)) {
         this.schedules[index].refreshSunEvents(this.sunTimes);
      }
   }
};

ScheduleService.prototype.coldStart = function() {
};

function Schedule(_owner, _config, _service) {
   this.uName = _service.uName + ":" + _owner.uName;
   this.service = _service;
   this.events = [];

   this.createEventsFromConfig(_owner, _config);
   this.scheduleAllEvents();
};

Schedule.prototype.createEventsFromConfig = function(_owner, _eventsConfig) {
   var eventsConfigLen = _eventsConfig.length;

   for (var index = 0; index < eventsConfigLen; ++index) {
      this.createEventFromConfig(_owner, _eventsConfig[index]);
   }
};

Schedule.prototype.createEventFromConfig = function(_owner, _eventConfig) {
   var origEventRule;
   var eventRuleDelta;

   if (typeof _eventConfig.rule == "string") {
      var arr = _eventConfig.rule.split(':');

      if (arr.length == 2) {
         origEventRule = arr[0];
         eventRuleDelta = parseInt(arr[1]);
      }
      else {
         origEventRule = _eventConfig.rule;
         eventRuleDelta = 0;
      }
   }
   else {
      origEventRule = _eventConfig.rule;
      eventRuleDelta = 0;
   }

   if (_eventConfig.hasOwnProperty("value")) {
      this.events.push({ name: _eventConfig.name, rule: origEventRule, originalRule: origEventRule, ruleDelta: eventRuleDelta,
                         sunTime: false, job: null, value: _eventConfig.value, owner: _owner, active: (_eventConfig.hasOwnProperty('active')) ? _eventConfig.active : true });
   }
   else if (_eventConfig.hasOwnProperty("ramp")) {
      this.events.push({ name: _eventConfig.name, rule: origEventRule, originalRule: origEventRule, ruleDelta: eventRuleDelta,
                         sunTime: false, job: null, ramp: _eventConfig.ramp, owner: _owner, active: (_eventConfig.hasOwnProperty('active')) ? _eventConfig.active : true });
   }
   else {
      this.events.push({ name: _eventConfig.name, rule: origEventRule, originalRule: origEventRule, ruleDelta: eventRuleDelta,
                         sunTime: false, job: null, owner: _owner, active: (_eventConfig.hasOwnProperty('active')) ? _eventConfig.active : true });
   }
};

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

Schedule.prototype.scheduleAllEvents = function() {
   this.setSunTimes(this.service.getSunTimes());

   for (var index = 0; index < this.events.length; ++index) {
      this.scheduleEvent(this.events[index]);
   }
}

Schedule.prototype.scheduleEvent = function(_event) {

   if (_event.active) {

      if (_event.sunTime) {

         if (_event.rule > new Date()) {
            this.resetJob(_event);
         }
      }
      else {
         this.resetJob(_event);
      }
   }
};

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

Schedule.prototype.addEvent = function(_event) {
   this.createEventFromConfig(_owner, _event);
   this.scheduleEvent(this.events[this.events.length - 1]);
};

Schedule.prototype.removeEvent = function(_eventName) {
   var index = -1;

   for (var i = 0; i < this.events.length; ++i) {

      if (this.events[i].name === _eventName) {
         index = i;
         break;
      }
   }

   if (index === -1) {
      return false;
   }

   if (this.events[index].job) {
     this.events[index].job.cancel();
     this.events[index].job = null;
   }

   this.events.splice(index, 1);
   return true;
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
 
