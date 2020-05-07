var util = require('util');
var Thing = require('../thing');

function Scheduler(_config, _parent) {
   Thing.call(this, _config, _parent);
   this.thingType = "scheduler";

   this.scheduleService =  this.casa.findService("scheduleservice");

   if (!this.scheduleService) {
      console.error(this.fullName + ": ***** Schedule service not found! *************");
      process.exit();
   }

   this.scheduleService.registerEvents(this, _config.events);
}

util.inherits(Scheduler, Thing);

Scheduler.prototype.scheduledEventTriggered = function(_event) {
   this.raiseEvent(_event.name, { sourceName: this.fullName, value: _event.value });
}

module.exports = exports = Scheduler;
