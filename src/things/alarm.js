var util = require('../util');
var Thing = require('../thing');

function Alarm(_config) {

   Thing.call(this, _config);
   this.thingType = "alarm";

   this.scheduleService =  this.gang.findService("scheduleservice");

   if (!this.scheduleService) {
      console.error(this.uName + ": ***** Schedule service not found! *************");
      process.exit();
   }

   this.scheduleService.registerEvents(this, _config.events);
}

util.inherits(Alarm, Thing);

Alarm.prototype.coldStart = function() {
   this.alignProperty('ACTIVE', true);
};

Alarm.prototype.scheduledEventTriggered = function(_event) {

   if (this.getProperty('ACTIVE') {
      this.raiseEvent(_event.name, { sourceName: this.uName, value: _event.value });
   }
}

module.exports = exports = Alarm;
