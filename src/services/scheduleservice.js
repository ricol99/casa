var util = require('util');
var schedule = require('node-schedule');
var SunCalc = require('suncalc');
var Parser = require('cron-parser');
var Service = require('../service');
var NamedObject = require('../namedobject');

function ScheduleService(_config, _owner) {
   Service.call(this, _config, _owner);

   // Defaults to London
   this.latitude = (_config.hasOwnProperty("latitude")) ? _config.latitude : 51.5;
   this.longitude = (_config.hasOwnProperty("longitude")) ? _config.longitude : -0.1;

   this.refreshScheduler = new RefreshScheduler(this);
   this.schedules = {};
}

util.inherits(ScheduleService, Service);

ScheduleService.prototype.registerEvents = function(_owner, _config) {
   var sched = new Schedule(_owner, _config, this);

   if (this.schedules[_owner.uName]) {
      console.error(this.uName + ": Conflict - an owner has registered more than one set of events! Not supported!");
      process.exit(3);
   }

   this.schedules[_owner.uName] = sched;
};

ScheduleService.prototype.getInitialValue = function(_owner) {
   return this.schedules[_owner.uName].getInitialValue();
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

function Schedule(_requester, _config, _owner) {
   NamedObject.call(this, { name: _requester.name, type: "schedule", transient: true }, _owner);
   this.requester = _requester;
   this.scheduledEvents = [];

   this.createEventsFromConfig(_config);
   this.scheduleAllEvents();
};

util.inherits(Schedule, NamedObject);

Schedule.prototype.getCasa = function() {
   return this.owner.getCasa();
}

Schedule.prototype.createEventsFromConfig = function(_eventsConfig) {
   var eventsConfigLen = _eventsConfig.length;

   for (var index = 0; index < eventsConfigLen; ++index) {
      this.createEventFromConfig(_eventsConfig[index]);
   }
};

Schedule.prototype.createRuleFromConfig = function(_event, _ruleConfig) {
   console.log(this.uName + ": createRuleFromConfig() ruleConfig="+JSON.stringify(_ruleConfig));
   var rule = { event: _event, sunTime: false, job: null };

   if (typeof _ruleConfig == "string") {
      var arr = _ruleConfig.split(':');

      if (arr.length >= 2) {
         rule.original = arr[0];
         rule.rule = arr[0];
         rule.delta = parseInt(arr[1]);
         rule.random = (arr.length === 3) ? (arr[2] === "random") : false;
      }
      else {
         rule.original = _ruleConfig;
         rule.rule = _ruleConfig;
         rule.delta = 0;
         rule.random = false;
      }
   }
   else {
      rule.original = _ruleConfig;
      rule.rule = _ruleConfig;
      rule.delta = 0;
      rule.random = false;
   }

   return rule;
};

Schedule.prototype.createEventFromConfig = function(_eventConfig) {
   var rules = [];

   if (_eventConfig.hasOwnProperty('rule')) {
      _eventConfig.rules = [ _eventConfig.rule ];
   }

   var event = { name: _eventConfig.name, owner: this.requester, rules: [], active: (_eventConfig.hasOwnProperty('active')) ? _eventConfig.active : true, config: _eventConfig };

   for (var i = 0; i < _eventConfig.rules.length; ++i) {
      event.rules.push(this.createRuleFromConfig(event, _eventConfig.rules[i]));
   }

   if (_eventConfig.hasOwnProperty("value")) {
      event.value = _eventConfig.value;
   }
   else if (_eventConfig.hasOwnProperty("ramp")) {
      event.ramp = util.copy(_eventConfig.ramp);
   }

   this.scheduledEvents.push(event);
};

Schedule.prototype.lastEventScheduledBeforeNow = function(_now, _rule) {

   var startDate = new Date();
   startDate.setTime(startDate.getTime()-(_now.getHours()*60*60*1000)-(_now.getSeconds()*60*1000));

   var options = {
      currentDate: startDate,
      endDate: _now,
      iterator: true
   };
   var lastScheduled = null;

   try {
      var interval = Parser.parseExpression(_rule.rule, options);
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

Schedule.prototype.determineClosestEvent = function(_now, _currentClosestEventSchedule, _event) {
   var closestRuleSchedule = _currentClosestEventSchedule;

   for (var i = 0; i < _event.rules.length; ++i) {
      var res = this.determineClosestRule(_now, _currentClosestEventSchedule, _event.rules[i]);

      if (res) {
         closestRuleSchedule = res;
      }
   }

   return (closestRuleSchedule === _currentClosestEventSchedule) ? null : closestRuleSchedule;
};

// Returns null if it is not closer or the new closestSchedule
Schedule.prototype.determineClosestRule = function(_now, _currentClosestSchedule, _rule) {

   var lastScheduled = (_rule.sunTime) ? _rule.rule : this.lastEventScheduledBeforeNow(_now, _rule);

   if (lastScheduled && lastScheduled < _now) {

      if (_currentClosestSchedule) {
         var currentClosestDelta = _now.getTime() - _currentClosestSchedule.getTime();
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
   this.setSunTimes(this.owner.getSunTimes());

   for (var index = 0; index < this.scheduledEvents.length; ++index) {
      this.scheduleEvent(this.scheduledEvents[index]);
   }
}

Schedule.prototype.scheduleEvent = function(_event) {

   if (_event.active) {

      for (var i = 0; i < _event.rules.length; ++i) {

         if (_event.rules[i].sunTime) {

            if (_event.rules[i].rule > new Date()) {
               this.resetJob(_event.rules[i]);
            }
         }
         else {
            this.resetJob(_event.rules[i]);
         }
      }
   }
};

Schedule.prototype.refreshSunEvents = function(_sunTimes) {
   this.setSunTimes(_sunTimes);

   for (var index = 0; index < this.scheduledEvents.length; ++index) {

      for (var rindex = 0; rindex < this.scheduledEvents[index].rules.length; ++rindex) {

         if (this.scheduledEvents[index].rules[rindex].sunTime && (this.scheduledEvents[index].rules[rindex].rule > new Date())) {
            this.resetJob(this.scheduledEvents[index].rules[rindex]);
         }
      }
   }
}

Schedule.prototype.setSunTimes = function(_sunTimes) {
   var result = false;

   for (var index = 0; index < this.scheduledEvents.length; ++index) {

      for (var rindex = 0; rindex < this.scheduledEvents[index].rules.length; ++rindex) {

         if ((typeof this.scheduledEvents[index].rules[rindex].original == 'string') && _sunTimes[this.scheduledEvents[index].rules[rindex].original]) {
            console.log(this.uName + ': Rule ' + this.scheduledEvents[index].rules[rindex].original + ' is a sun time');
            this.scheduledEvents[index].rules[rindex].rule = new Date(_sunTimes[this.scheduledEvents[index].rules[rindex].original]);
            this.scheduledEvents[index].rules[rindex].rule.setTime(this.scheduledEvents[index].rules[rindex].rule.getTime() + (this.scheduledEvents[index].rules[rindex].delta * 1000));
            this.scheduledEvents[index].rules[rindex].sunTime = true;
            console.log(this.uName + ': Sun time ' + this.scheduledEvents[index].rules[rindex].original + ' for start of schedule. Actual scheduled time is ' + this.scheduledEvents[index].rules[rindex].rule);
         }
         else if (this.scheduledEvents[index].rules[rindex].random) {
            //  *** TBD how do we intepret CRON? Only a subset, one time per day per rule?
         }
      }
   }
}

Schedule.prototype.resetJob = function(_rule) {
   
   if (_rule.job) {
     _rule.job.cancel();
   }

   _rule.job = schedule.scheduleJob(_rule.rule, function() {
      // this = _event.job
      this.myRule.event.owner.scheduledEventTriggered(this.myRule.event);
   });

   if (_rule.job) {
      _rule.job.myRule = _rule;
      _rule.job.mySchedule = this;
   }
   else {
      console.error(this.uName + ": Unable to schedule rule '" + _rule.rule +"' for owner " + _rule.event.owner.uName);
      throw(this.name + ": Unable to schedule rule '" + _rule.rule +"' for owner " + _rule.event.owner.uName);
   }
}

Schedule.prototype.getInitialValue = function() {
   var closestEvent = null;
   var closestEventSchedule = null;
   var now = new Date();

   for (var index = 0; index < this.scheduledEvents.length; ++index) {
      var tempClosestSchedule = this.determineClosestEvent(now, closestEventSchedule, this.scheduledEvents[index]);

      if (tempClosestSchedule) {
         closestEvent = this.scheduledEvents[index];
         closestEventSchedule = new Date(tempClosestSchedule);
      }
   }

   if (closestEvent) {
      console.log(this.uName + ": Closest event is " + closestEvent.rules[0].rule);

      if (closestEvent.hasOwnProperty("ramp")) {

         if (closestEvent.ramp.hasOwnProperty("ramps")) {
            return { initialValueFound: true, value: closestEvent.ramp.ramps[closestEvent.ramp.ramps.length-1].endValue };
         }
         else {
            return { initialValueFound: true, value: closestEvent.ramp.endValue };
         }
      }
      else {
         console.log(this.uName + ": Closest Event - initial value = " + closestEvent.value);
         return { initialValueFound: true, value: closestEvent.value };
      }
   }
   else {
      return { initialValueFound: false };
   }
};

Schedule.prototype.addEvent = function(_event) {
   this.createEventFromConfig(_event);
   this.scheduleEvent(this.scheduledEvents[this.scheduledEvents.length - 1]);
};

Schedule.prototype.removeEvent = function(_eventName) {
   var index = -1;

   for (var i = 0; i < this.scheduledEvents.length; ++i) {

      if (this.scheduledEvents[i].name === _eventName) {
         index = i;
         break;
      }
   }

   if (index === -1) {
      return false;
   }

   if (this.scheduledEvents[index].job) {
     this.scheduledEvents[index].job.cancel();
     this.scheduledEvents[index].job = null;
   }

   this.scheduledEvents.splice(index, 1);
   return true;
};

function RefreshScheduler(_schedulerService) {
   this.schedulerService = _schedulerService;

   var refreshJob = schedule.scheduleJob('10 1 * * *', () => {
      this.schedulerService.refreshSunEvents();
   });
}

module.exports = exports = ScheduleService;
 
