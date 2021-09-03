var util = require('util');
var Event = require('../event');
var Gang = require('../gang');

function ScheduleEvent(_config, _owner) {
   Event.call(this, _config, _owner);

   this.config = util.copy(_config, true);

   var gang = Gang.mainInstance();
   this.scheduleService = gang.casa.findService("scheduleservice");

   if (!this.scheduleService) {
      console.error(this.uName + ": ***** Schedule service not found! *************");
      process.exit(1);
   }
}

util.inherits(ScheduleEvent, Event);

ScheduleEvent.prototype.coldStart = function(_data) {
   Event.prototype.coldStart.call(this, _data);

   this.scheduleService.addEvent(this, this.config);
};

ScheduleEvent.prototype.aboutToBeDeleted = function() {
   this.scheduleService.removeEvent(this, this.name);
};

ScheduleEvent.prototype.scheduledEventTriggered = function(_event) {

   if (_event.hasOwnProperty("value")) {
      this.value = _event.value;
   }

   this.raise();
};

module.exports = exports = ScheduleEvent;
 
