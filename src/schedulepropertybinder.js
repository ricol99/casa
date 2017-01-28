var util = require('util');
var PropertyBinder = require('./propertybinder');
var schedule = require('node-schedule');
var SunCalc = require('suncalc');
var Forecast = require('forecast.io');
var Parser = require('cron-parser');

var sunScheduler = null;

function SunScheduler(_latitude, _longitude, _apiKey) {
   this.states = [];
   var that = this;

   var refreshJob = schedule.scheduleJob('10 1 * * *', function() {

      that.getSunTimes(_latitude, _longitude, _apiKey, function(_sunTimes) {
         var len = that.states.length;

         for (var i = 0; i < len; ++i) {
            resetSunJobs(that.states[i], _sunTimes);
         }
      });
   });
}

SunScheduler.prototype.getSunTimes = function(_latitude, _longitude, _apiKey, _callback) {
   var sunriseDelta = 0;
   var sunsetDelta = 0;

   var options = { APIKey: _apiKey, timeout: 5000 };
   var forecast = new Forecast(options);

   var sunTimes = SunCalc.getTimes(new Date(), _latitude, _longitude);

   forecast.getAtTime(_latitude, _longitude, new Date(), function (_err, _res, _data) {
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
      }
      _callback(sunTimes);
   });
}

function SchedulePropertyBinder(_config, _owner) {

   // Defaults to London
   this.latitude = (_config.latitude) ? _config.latitude : 51.5;
   this.longitude = (_config.longitude) ? _config.longitude : -0.1;
   this.forecastKey = (_config.forecastKey) ? _config.forecastKey : "5d3be692ae5ea4f3b785973e1f9ea520";

   this.startRuleIsSunTime = false;
   this.endRuleIsSunTime = false;

   PropertyBinder.call(this, _config, _owner);

   this.writable = false;
   this.events = [];
   this.currentRamp = {};

   createEventsFromConfig(this, _config.events);

   var that = this;

   if (!sunScheduler) {
      sunScheduler = new SunScheduler(this.latitude, this.longitude, this.forecastKey);
   }

   sunScheduler.states.push(this);
}

util.inherits(SchedulePropertyBinder, PropertyBinder);

function copyData(_sourceData) {
   var newData = {};

   for (var prop in _sourceData) {

      if (_sourceData.hasOwnProperty(prop)){
         newData[prop] = _sourceData[prop];
      }
   }

   return newData;
}

function startRamp(_that) {

   if (_that.currentRamp.timer) {
      clearTimeout(_that.currentRamp.timer);
   }

   _that.currentRamp.timer = setTimeout(function(_this) {
      _this.currentRamp.timer = null;

      if (_this.binderEnabled) {
        var difference = Math.abs(_this.currentRamp.endValue - _this.currentRamp.value);

         if (difference <= Math.abs(_this.currentRamp.step)) {
            _this.updatePropertyAfterRead(_this.currentRamp.endValue, { sourceName: _this.ownerName });
         }
         else {
            _this.currentRamp.value += _this.currentRamp.step;
            _this.updatePropertyAfterRead(_this.currentRamp.floorOutput(_this.currentRamp.value), { sourceName: _this.ownerName });
            startRamp(_this);
         }
      }
   }, _that.currentRamp.interval * 1000, _that);
}

function createEventsFromConfig(_this, _eventsConfig) {
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

      _this.events.push({ rule: origEventRule, originalRule: origEventRule, ruleDelta: eventRuleDelta,
                         sunTime: false, job: null, propertyValue: _eventsConfig[index].propertyValue,
                         ramp:  _eventsConfig[index].ramp });
   }
}

function lastEventScheduledBeforeNow(_this, _now, _event) {

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
       console.log(_this.name + ': Error: ' + err.message);
    }

    return (lastScheduled) ? lastScheduled.value : null;
}

// Returns null if it is not closer or the new closestSchedule
function determineClosestEvent(_this, _now, _currentClosestEventSchedule, _event) {

   var lastScheduled = (_event.sunTime) ? _event.rule : lastEventScheduledBeforeNow(_this, _now, _event);

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
}

function scheduleAllJobs(_this, _callback) {
   var that = _this;

   sunScheduler.getSunTimes(_this.latitude, _this.longitude, _this.forecastKey, function(_sunTimes) {
      setSunTimes(that, _sunTimes);

      for (var index = 0; index < that.events.length; ++index) {

         if (that.events[index].sunTime) {

            if (that.events[index].rule > new Date()) {
               resetJob(that, that.events[index]);
            }
         }
         else {
            resetJob(that, that.events[index]);
         }
      }
      _callback();
   });
}

function resetSunJobs(_this, _sunTimes) {
   setSunTimes(_this, _sunTimes);

   for (var index = 0; index < _this.events.length; ++index) {

      if (_this.events[index].sunTime && (_this.events[index].rule > new Date())) {
         resetJob(_this, _this.events[index]);
      }
   }
}

function setSunTimes(_this, _sunTimes) {

   if (_sunTimes == undefined) {
      _sunTimes = SunCalc.getTimes(new Date(), _this.latitude, _this.longitude);
   }

   var result = false;
   var eventsLen = _this.events.length;

   for (var index = 0; index < eventsLen; ++index) {

      if ((typeof _this.events[index].originalRule == 'string') && _sunTimes[_this.events[index].originalRule]) {
         console.log(_this.name + ': Rule ' + _this.events[index].originalRule + ' is a sun time');
         _this.events[index].rule = new Date(_sunTimes[_this.events[index].originalRule]);
         _this.events[index].rule.setTime(_this.events[index].rule.getTime() + (_this.events[index].ruleDelta * 1000));
         _this.events[index].sunTime = true;
         console.log(_this.name + ': Sun time ' + _this.events[index].originalRule + ' for start of schedule. Actual scheduled time is ' + _this.events[index].rule);
      }
   }
}

function resetJob(_this, _event) {
   var that = _this;
   
   if (_event.job) {
     _event.job.cancel();
   }

   _event.job = schedule.scheduleJob(_event.rule, function() {

      if (_event.ramp == undefined) {
         that.updatePropertyAfterRead(_event.propertyValue , { sourceName: that.ownerName });
      }
      else {
         createNewRamp(that, _event);
      }
   });
}

function createNewRamp(_this, _event) {

   if (_event.ramp.startValue != undefined) {
      _this.updatePropertyAfterRead(_event.ramp.startValue , { sourceName: _this.ownerName });
   }

   _this.currentRamp.endValue = _event.ramp.endValue;
   _this.currentRamp.duration = _event.ramp.duration;
   _this.currentRamp.step = _event.ramp.step;
   _this.currentRamp.value = (_event.ramp.startValue != undefined) ? _event.ramp.startValue : _this.myPropertyValue();
   _this.currentRamp.floorOutput = (_event.ramp.floorOutput == undefined) ? function(_input) { return Math.floor(_input); } : function(_input) { return _input; };

   var difference = Math.abs(_this.currentRamp.endValue - _this.currentRamp.value);
   var noOfSteps = difference / Math.abs(_this.currentRamp.step);
   _this.currentRamp.interval = _this.currentRamp.duration / noOfSteps;

   startRamp(_this);
}

SchedulePropertyBinder.prototype.coldStart = function(_event) {
   var that = this;

   scheduleAllJobs(this, function() {
      var closestEvent = null;
      var closestEventSchedule = null;
      var now = new Date();

      for (var index = 0; index < that.events.length; ++index) {
         var tempClosestSchedule = determineClosestEvent(that, now, closestEventSchedule, that.events[index]);

         if (tempClosestSchedule) {
            closestEvent = that.events[index];
            closestEventSchedule = new Date(tempClosestSchedule);
         }
      }

      if (!closestEvent) {
         closestEvent = that.events[that.events.length-1];
      }

      // Set Initial Value
      console.log(that.name + ": Closest event is " + closestEvent.rule);
      var value = (closestEvent.ramp == undefined) ? closestEvent.propertyValue : closestEvent.ramp.endValue;
      that.updatePropertyAfterRead(value, { sourceName: that.owner.name, coldStart: true });
   });
}

module.exports = exports = SchedulePropertyBinder;
 
