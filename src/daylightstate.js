var util = require('util');
var State = require('./state');
var schedule = require('node-schedule');
var SunCalc = require('suncalc');

function DaylightState(_obj) {

   this.writable = false;
   this.morningDelta = (_obj.morningDelta) ? _obj.morningDelta : 0;
   this.eveningDelta = (_obj.eveningDelta) ? _obj.eveningDelta : 0;

   // Defaults to London
   this.latitude = (_obj.latitude) ? _obj.latitude : 51.5;
   this.longitude = (_obj.longitude) ? _obj.longitude : -0.1;

   State.call(this, _obj.name, _obj.casa);

   this.active = false;
   this.coldStart = true;

   var that = this;

   this.refreshJob = schedule.scheduleJob('1 0 * * *', function() {
      var times = SunCalc.getTimes(new Date(), that.latitude, that.longitude);

      // Adjust times by specified delta
      times.sunriseEnd.setSeconds(times.sunriseEnd.getSeconds() + that.morningDelta);
      times.sunsetStart.setSeconds(times.sunsetStart.getSeconds() + that.eveningDelta);

     // Schedule morning and evening jobs
      var morningJob = schedule.scheduleJob(times.sunsetStart, function() {

         if (that.coldStart) {
            that.coldStart = false;
            that.active = false;
         }

         if (!that.active) {
            that.active = true;
            that.emit('active', that.name);
         }
      });

      var eveningJob = schedule.scheduleJob(times.sunriseEnd, function() {

         if (that.coldStart) {
            that.coldStart = false;
            that.active = true;
         }

         if (that.active) {
            that.active = false;
            that.emit('inactive', that.name);
         }
      });
   });
}

util.inherits(DaylightState, State);

DaylightState.prototype.setActive = function(_callback) {
   _callback(false);
}

DaylightState.prototype.setInactive = function(_callback) {
   _callback(false);
}

module.exports = exports = DaylightState;
 
