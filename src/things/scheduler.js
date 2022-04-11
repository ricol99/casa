var util = require('util');
var Thing = require('../thing');

function Scheduler(_config, _parent) {
   Thing.call(this, _config, _parent);
   this.thingType = "scheduler";

   this.scheduleService =  this.casa.findService("scheduleservice");

   if (!this.scheduleService) {
      console.error(this.uName + ": ***** Schedule service not found! *************");
      process.exit();
   }

   this.scheduleService.registerEvents(this, _config.events);
}

util.inherits(Scheduler, Thing);

// Called when current state required
Scheduler.prototype.export = function(_exportObj) {
   Thing.prototype.export.call(this, _exportObj);
};

// Called when current state required
Scheduler.prototype.import = function(_importObj) {
   Thing.prototype.import.call(this, _importObj);
};

Scheduler.prototype.coldStart = function() { 
   Thing.prototype.coldStart.call(this);
};

Scheduler.prototype.hotStart = function() {
   Thing.prototype.hotStart.call(this);
};

Scheduler.prototype.scheduledEventTriggered = function(_event) {
   this.raiseEvent(_event.name, { sourceName: this.uName, value: _event.value });
}

module.exports = exports = Scheduler;
