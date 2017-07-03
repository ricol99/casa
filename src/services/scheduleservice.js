var util = require('util');
var schedule = require('node-schedule');
var SunCalc = require('suncalc');
var Forecast = require('forecast.io');
var Parser = require('cron-parser');
var Service = require('../service');

function ScheduleService(_config) {
   Service.call(this, _config);

   // Defaults to London
   this.latitude = (_config.hasOwnProperty("latitude")) ? _config.latitude : 51.5;
   this.longitude = (_config.hasOwnProperty("longitude")) ? _config.longitude : -0.1;
   this.forecastKey = (_config.hasOwnProperty("forecastKey")) ? _config.forecastKey : "5d3be692ae5ea4f3b785973e1f9ea520";

   this.refreshScheduler = new RefreshScheduler(this.latitude, this.longitude, this.forecastKey, this);
   this.sunTimeCallbacks = [];
   this.schedules = [];
}

util.inherits(ScheduleService, Service);

ScheduleService.prototype.registerEvents = function(_owner, _config) {
   this.schedules.push(new Schedule(_owner, _config, this));
};

ScheduleService.prototype.getSunTimes = function(_callback) {
   var that = this;

   if (!this.sunTimes) {
      this.sunTimeCallbacks.push(_callback);

      if (this.sunTimeCallbacks.length == 1) {

         this.refreshScheduler.getSunTimes(this.latitude, this.longitude, this.forecastKey, function(_sunTimes) {
            that.sunTimes = _sunTimes;

            for (var i = 0; i < that.sunTimeCallbacks.length; ++i) {
               that.sunTimeCallbacks[i](this.sunTimes);
            }
            that.sunTimeCallbacks = [];
         });
      }
   }
   else {
      _callback(this.sunTimes);
   }
};

ScheduleService.prototype.refreshSunEvents = function(_sunTimes) {

   for (var index = 0; index < this.schedules.length; ++index) {
      this.schedules[index].refreshSunEvents(_sunTimes);
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
                          sunTime: false, job: null, propertyValue: _eventsConfig[index].propertyValue, ramp:  _eventsConfig[index].ramp, owner: _owner });
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

Schedule.prototype.scheduleAllJobs = function(_callback) {
   var that = this;

   this.service.getSunTimes(function(_sunTimes) {
      that.setSunTimes(_sunTimes);

      for (var index = 0; index < that.events.length; ++index) {

         if (that.events[index].sunTime) {

            if (that.events[index].rule > new Date()) {
               that.resetJob(that.events[index]);
            }
         }
         else {
            that.resetJob(that.events[index]);
         }
      }
      _callback();
   });
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

   if (_sunTimes == undefined) {
      _sunTimes = SunCalc.getTimes(new Date(), this.latitude, this.longitude);
   }

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
         _event.owner.scheduledEventTriggered(_event, _event.propertyValue);
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
   var that = this;

   this.scheduleAllJobs(function() {
      var closestEvent = null;
      var closestEventSchedule = null;
      var now = new Date();

      for (var index = 0; index < that.events.length; ++index) {
         var tempClosestSchedule = that.determineClosestEvent(now, closestEventSchedule, that.events[index]);

         if (tempClosestSchedule) {
            closestEvent = that.events[index];
            closestEventSchedule = new Date(tempClosestSchedule);
         }
      }

      if (!closestEvent) {
         closestEvent = that.events[that.events.length-1];
      }

      // Set Initial Value
      console.log(that.uName + ": Closest event is " + closestEvent.rule);
      var value = (closestEvent.ramp == undefined) ? closestEvent.propertyValue : closestEvent.ramp.endValue;

      closestEvent.owner.scheduledEventTriggered(closestEvent, value, true);
   });
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

function RefreshScheduler(_latitude, _longitude, _apiKey, _schedulerService) {
   this.schedulerService = _schedulerService;
   var that = this;

   var refreshJob = schedule.scheduleJob('10 1 * * *', function() {

      that.getSunTimes(_latitude, _longitude, _apiKey, function(_sunTimes) {
         that.sunTimes = _sunTimes;
         that.schedulerService.refreshSunEvents(_sunTimes);
      });
   });
}

RefreshScheduler.prototype.getSunTimes = function(_latitude, _longitude, _apiKey, _callback) {
   var sunriseDelta = 0;
   var sunsetDelta = 0;

   var options = { APIKey: _apiKey, timeout: 5000 };
   var forecast = new Forecast(options);

   var sunTimes = SunCalc.getTimes(new Date(), _latitude, _longitude);

   /*forecast.getAtTime(_latitude, _longitude, new Date(), function(_err, _res, _data) {
      var sunriseIndex = 0;
      var sunsetIndex = 0;

      if (!_err && _data.hourly && _data.hourly.data) {

         for (var index = 0; index < _data.hourly.data.length; ++index) {

            if (_data.hourly.data[index].time*1000 > sunTimes["sunrise"].getTime() && index > 0) {
               sunriseIndex = index - 1;
               break;
            }
         }

         for (var index2 = index; index2 < _data.hourly.data.length; ++index2) {

            if (_data.hourly.data[index2].time*1000 > sunTimes["sunsetStart"].getTime() && index2 > 0) {
               sunsetIndex = index2 - 1;
               break;
            }
         }
    
         if (_data.hourly.data[sunriseIndex].cloudCover > 0.2) {
            sunriseDelta = _data.hourly.data[sunriseIndex].cloudCover * 3600;
         }

         if (_data.hourly.data[sunsetIndex].cloudCover > 0.2) {
            sunsetDelta = _data.hourly.data[sunsetIndex].cloudCover * 3600;
         }

         sunTimes["sunrise"].setTime(sunTimes["sunrise"].getTime() + (sunriseDelta * 1000));
         sunTimes["sunriseEnd"].setTime(sunTimes["sunriseEnd"].getTime() + (sunriseDelta * 1000));
         sunTimes["sunsetStart"].setTime(sunTimes["sunsetStart"].getTime() - (sunsetDelta * 1000));
         sunTimes["sunset"].setTime(sunTimes["sunset"].getTime() - (sunsetDelta * 1000));
         console.info("Sunrise Cloud Cover = " + _data.hourly.data[sunriseIndex].cloudCover + " Sunrise Delta = " + sunriseDelta);
         console.info("Sunset Cloud Cover = " + _data.hourly.data[sunsetIndex].cloudCover + " Sunset Delta = " + sunsetDelta);
      }
      else {
         console.info("SCHEDULER unable to get sunrise time! Error = ", _err.code);
      }*/
      _callback(sunTimes);
   //});
}

module.exports = exports = ScheduleService;
 
