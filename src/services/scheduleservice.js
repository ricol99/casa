var util = require('util');
var schedule = require('node-schedule');
var SunCalc = require('suncalc');
var Parser = require('cron-parser');
var Service = require('../service');

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
   var that = this;

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
   var that = this;
};

function Schedule(_owner, _config, _service) {
   this.uName = _service.uName + ":" + _owner.uName;
   this.service = _service;
   this.events = [];
   this.ramps = {};

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

      this.events.push({ name: _eventsConfig[index].name, rule: origEventRule, originalRule: origEventRule, ruleDelta: eventRuleDelta,
                          sunTime: false, job: null, value: _eventsConfig[index].value, ramp:  _eventsConfig[index].ramp, owner: _owner });
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
   var that = this;

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
   var that = this;
   
   if (_event.job) {
     _event.job.cancel();
   }

   _event.job = schedule.scheduleJob(_event.rule, function() {

      if (_event.ramp == undefined) {
         _event.owner.scheduledEventTriggered(_event, _event.value);
      }
      else {
         that.startNewRamp(_event);
      }
   });
}

Schedule.prototype.startNewRamp = function(_event) {

   if (_event.ramp.startValue != undefined) {
      _event.owner.scheduledEventTriggered(_event, _event.ramp.startValue);
   }

   var endValue = _event.ramp.endValue;
   var duration = _event.ramp.duration;
   var step = _event.ramp.step;
   var value = (_event.ramp.startValue != undefined) ? _event.ramp.startValue : _event.owner.getRampStartValue(_event);
   var floorOutput = (_event.ramp.floorOutput != undefined) ? _event.ramp.floorOutput : true;

   var difference = Math.abs(endValue - value);
   var noOfSteps = difference / Math.abs(step);
   var interval = duration / noOfSteps;

   if (this.ramps[_event.name] == undefined) {
      this.ramps[_event.name] = new Ramp(_event);
   }

   this.ramps[_event.name].start(value, endValue, step, interval, floorOutput);
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
   return (closestEvent.ramp == undefined) ? closestEvent.propertyValue : closestEvent.ramp.endValue;
};

function Ramp(_event) {
   this.event = _event;
};

Ramp.prototype.start = function(_value, _endValue, _step, _interval, _floorOutput) {
   this.value = _value;
   this.endValue = _endValue;
   this.step = _step;
   this.interval = _interval;
   this.floorOutput = _floorOutput;

   this.nextInterval();
};

Ramp.prototype.nextInterval = function() {

   if (this.timer) {
      clearTimeout(this.timer);
   }

   this.timer = setTimeout(function(_this) {
      _this.timer = null;

     var difference = Math.abs(_this.endValue - _this.value);

      if (difference <= Math.abs(_this.step)) {
         _this.event.owner.scheduledEventTriggered(_this.event, _this.endValue);
      }
      else {
         _this.value += _this.step;
         _this.event.owner.scheduledEventTriggered(_this.event, (_this.floorOutput) ? Math.floor(_this.value) : _this.value);
         _this.nextInterval();
      }
   }, this.interval * 1000, this);
};

function RefreshScheduler(_schedulerService) {
   this.schedulerService = _schedulerService;
   var that = this;

   var refreshJob = schedule.scheduleJob('10 1 * * *', function() {
      that.schedulerService.refreshSunEvents();
   });
}

module.exports = exports = ScheduleService;
 
