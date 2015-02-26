var util = require('util');
var State = require('./state');
var schedule = require('node-schedule');

function ScheduleState(_obj) {

   this.writable = false;
   this.startRule = _obj.startRule;

   if (_obj.endRule) {
      this.endRule = _obj.endRule;
   }
   else {
      this.endRule = null;
      this.activeFor = _obj.activeFor;
   }

   State.call(this, _obj.name, _obj.casa);

   this.active = false;

   var that = this;

   this.startJob = schedule.scheduleJob(this.startRule, function(){

      if (!that.active) {
         that.active = true;
         that.emit('active', that.name);

         if (!this.endRule) {
            setTimeout(function() {
               that.active = false;
               that.emit('inactive', that.name);
            }, this.activeFor*1000);
         }
      }
   });

   if (this.endRule) {
      this.endJob = schedule.scheduleJob(this.endRule, function(){

         if (that.active) {
            that.active = false;
            that.emit('active', that.name);
         }
      });
   }
}

util.inherits(ScheduleState, State);

ScheduleState.prototype.setActive = function(_callback) {
   _callback(false);
}

ScheduleState.prototype.setInactive = function(_callback) {
   _callback(false);
}

module.exports = exports = ScheduleState;
 
