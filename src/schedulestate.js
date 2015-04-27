var util = require('util');
var State = require('./state');
var schedule = require('node-schedule');
var SunCalc = require('suncalc');

var sunScheduler = null;

function SunScheduler() {
   this.states = [];

   var that = this;

   var refreshJob = schedule.scheduleJob('10 1 * * *', function() {
      var len = that.states.length;

      for (var i = 0; i < len; ++i) {
         that.states[i].resetSunTimes();
      }
   });
}

function ScheduleState(_config) {

   this.writable = false;

   // Defaults to London
   this.latitude = (_config.latitude) ? _config.latitude : 51.5;
   this.longitude = (_config.longitude) ? _config.longitude : -0.1;

   this.startRuleIsSunTime = false;
   this.endRuleIsSunTime = false;

   State.call(this, _config);

   if (typeof _config.startRule == "string") {
      var arr = _config.startRule.split(':');

      if (arr.length == 2) {
         this.origStartRule = arr[0];
         this.startDelta = parseInt(arr[1]);
      }
      else {
         this.origStartRule = _config.startRule;
         this.startDelta = 0;
      }
   }
   else {
      this.origStartRule = _config.startRule;
      this.startDelta = 0;
   }

   this.startRule = this.origStartRule;

   if (_config.endRule) {

      if (typeof _config.endRule == "string") {
         var arr = _config.endRule.split(':');

         if (arr.length == 2) {
            this.origEndRule = arr[0];
            this.endDelta = parseInt(arr[1]);
         }
         else {
            this.origEndRule = _config.endRule;
            this.endDelta = 0;
         }
      }
      else {
         this.origEndRule = _config.endRule;
         this.endDelta = 0;
      }

      this.endRule = this.origEndRule;
      this.activeFor = null;
   }
   else {
      this.origEndRule = null;
      this.endRule = null;
      this.activeFor = _config.activeFor;
   }

   this.active = false;
   this.startingFromCold = true;
   this.startJob = null;
   this.endJob = null;

   var that = this;

   if (this.setSunTimes()) {

      if (!sunScheduler) {
         sunScheduler = new SunScheduler();
      }

      sunScheduler.states.push(this);

      if (this.startRuleIsSunTime) {

         if (this.startRule > new Date()) {
            this.resetStartJob();
         }
      }
      else {
         this.resetStartJob();
      }

      if (this.endRuleIsSunTime) {

         if (this.endRule > new Date()) {
            this.resetEndJob();
         }
      }
      else {
         this.resetEndJob();
      }
   }
   else {
      this.resetStartJob();
      this.resetEndJob();
   }
}

util.inherits(ScheduleState, State);

ScheduleState.prototype.resetSunTimes = function() {
  this.setSunTimes();

  if ((this.startRuleIsSunTime) && (this.startRule > new Date())) {
     this.resetStartJob();
  }

  if ((this.endRuleIsSunTime) && (this.endRule > new Date())) {
     this.resetEndJob();
  }
}

ScheduleState.prototype.setSunTimes = function() {
   var result = false;
   this.times = SunCalc.getTimes(new Date(), this.latitude, this.longitude);

   if ((typeof this.origStartRule == 'string') && this.times[this.origStartRule]) {
      console.log(this.name + ': Start rule is a sun time =  ' + this.origStartRule);
      this.startRule = this.times[this.origStartRule];
      this.startRule.setSeconds(this.startRule.getSeconds() + this.startDelta);
      this.startRuleIsSunTime = true;
      result = true;
      console.log(this.name + ': Sun time ' + this.origStartRule + ' for start of schedule. Actual scheduled time is ' + this.startRule);
   }
   
   if (this.origEndRule && ((typeof this.origEndRule == 'string') && this.times[this.origEndRule])) {
      console.log(this.name + ': End rule is a sun time =  ' + this.origEndRule);
      this.endRule = this.times[this.origEndRule];
      this.endRule.setSeconds(this.endRule.getSeconds() + this.endDelta);
      this.endRuleIsSunTime = true;
      console.log(this.name + ': Sun time ' + this.origEndRule + ' for end of schedule. Actual scheduled time is ' + this.endRule);
      result = true;
   }

   return result;
}

ScheduleState.prototype.resetStartJob = function() {
   var that = this;
   
   if (this.startJob) {
     this.startJob.cancel();
   }

   this.startJob = schedule.scheduleJob(this.startRule, function() {

      if (that.startingFromCold) {
         that.startingFromCold = false;
         that.active = false;
      }

      if (!that.active) {
         that.active = true;
         that.emit('active', { sourceName: that.name });

         if (that.activeFor) {
            setTimeout(function() {
               that.active = false;
               that.emit('inactive', { sourceName: that.name });
            }, that.activeFor*1000);
         }
      }
   });
}

ScheduleState.prototype.resetEndJob = function() {
   var that = this;

   if (this.endRule) {

      if (this.endJob) {
         this.endJob.cancel();
      }

      this.endJob = schedule.scheduleJob(this.endRule, function() {

         if (that.startingFromCold) {
            that.startingFromCold = false;
            that.active = true;
         }

         if (that.active) {
            that.active = false;
            that.emit('inactive', { sourceName: that.name });
         }
      });
   }
}


ScheduleState.prototype.setActive = function(_callback) {
   _callback(false);
}

ScheduleState.prototype.setInactive = function(_callback) {
   _callback(false);
}

module.exports = exports = ScheduleState;
 
