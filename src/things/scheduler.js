var util = require('util');
var Thing = require('../thing');
var CasaSystem = require('../casasystem');

function Scheduler(_config) {
   this.casaSys = CasaSystem.mainInstance();

   Thing.call(this, _config);
   this.thingType = "scheduler";

   this.scheduleService =  this.casaSys.findService("scheduleservice");

   if (!this.scheduleService) {
      console.error(this.uName + ": ***** Schedule service not found! *************");
      process.exit();
   }

   this.scheduleService.registerEvents(this, _config.events);
}

util.inherits(Scheduler, Thing);

Scheduler.prototype.scheduledEventTriggered = function(_event, _value, _coldStart) {
   var data = { sourceName: this.owner.uName, value: _value };

   if (_coldStart) {
      data.coldStart = true;
   }

   this.raiseEvent(_event.name, data);
}

Scheduler.prototype.getRampStartValue = function(_event) {
   return 0;
}
module.exports = exports = Scheduler;