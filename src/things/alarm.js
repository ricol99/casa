var util = require('../util');
var Thing = require('../thing');

function Alarm(_config, _parent) {

   Thing.call(this, _config, _parent);
   this.thingType = "alarm";

   this.scheduleService =  this.gang.casa.findService("scheduleservice");

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

      if (_event.hasOwnProperty("value")) {
         this.raiseEvent(_event.name, { sourceName: this.fullName, value: _event.value });
      }
      else {
         this.raiseEvent(_event.name, { sourceName: this.fullName });
      }
   }
}

module.exports = exports = Alarm;
