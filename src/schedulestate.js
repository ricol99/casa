var util = require('util');
var State = require('./state');
var schedule = require('node-schedule');
var SunCalc = require('suncalc');

function ScheduleState(_obj) {

   this.writable = false;

   // Defaults to London
   this.latitude = (_obj.latitude) ? _obj.latitude : 51.5;
   this.longitude = (_obj.longitude) ? _obj.longitude : -0.1;

   this.startRuleIsSunTime = false;
   this.endRuleIsSunTime = false;

   State.call(this, _obj.name, _obj.casa);

   if (typeof _obj.startRule == "string") {
      var arr = _obj.startRule.split(':');

      if (arr.length == 2) {
         this.origStartRule = arr[0];
         this.startDelta = parseInt(arr[1]);
      }
      else {
         this.origStartRule = _obj.startRule;
         this.startDelta = 0;
      }
   }
   else {
      this.origStartRule = _obj.startRule;
      this.startDelta = 0;
   }

   this.startRule = this.origStartRule;

   if (_obj.endRule) {

      if (typeof _obj.endRule == "string") {
         var arr = _obj.endRule.split(':');

         if (arr.length == 2) {
            this.origEndRule = arr[0];
            this.endDelta = parseInt(arr[1]);
         }
         else {
            this.origEndRule = _obj.endRule;
            this.endDelta = 0;
         }
      }
      else {
         this.origEndRule = _obj.endRule;
         this.endDelta = 0;
      }

      this.endRule = this.origEndRule;
      this.activeFor = null;
   }
   else {
      this.origEndRule = null;
      this.endRule = null;
      this.activeFor = _obj.activeFor;
   }

   this.active = false;
   this.coldStart = true;
   this.startJob = null;
   this.endJob = null;

   var that = this;

   if (this.setSunTimes()) {

      this.refreshJob = schedule.scheduleJob('1 0 * * *', function() {
         that.setSunTimes();

         if (that.startRuleIsSunTime) {
            that.resetStartJob();
         }
         if (that.endRuleIsSunTime) {
            that.resetEndJob();
         }
      });

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

ScheduleState.prototype.setSunTimes = function() {
   var result = false;
   this.times = SunCalc.getTimes(new Date(), this.latitude, this.longitude);

   if ((typeof this.origStartRule == 'string') && this.times[this.origStartRule]) {
      this.startRule = this.times[this.origStartRule];
      this.startRule.setSeconds(this.startRule.getSeconds() + this.startDelta);
      this.startRuleIsSunTime = true;
      result = true;
      console.log(this.name + ': Sun time ' + this.origStartRule + ' for start of schedule. Actual scheduled time is ' + this.startRule);
   }
   
   if (this.origEndRule && ((typeof this.origEndRule == 'string') && this.times[this.origEndRule])) {
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

      if (that.coldStart) {
         that.coldStart = false;
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

         if (that.coldStart) {
            that.coldStart = false;
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
 
