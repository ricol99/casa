var util = require('util');
var Property = require('../property');
var Gang = require('../gang');

function ScheduleProperty(_config, _owner) {

   Property.call(this, _config, _owner);

   this.gang = Gang.mainInstance();
   this.scheduleService = this.gang.findService("scheduleservice");

   if (!this.scheduleService) {
      console.error(this.uName + ": ***** Schedule service not found! *************");
      process.exit(1);
   }

   this.writable = false;
   this.events = [];

   this.scheduleService.registerEvents(this, _config.events);

   if (_config.events.length > 1) {
      this.value = this.scheduleService.getInitialValue(this);
   }
}

util.inherits(ScheduleProperty, Property);

ScheduleProperty.prototype.scheduledEventTriggered = function(_event) {

   if (_event.hasOwnProperty("value")) {
      this.updatePropertyInternal(_event.value, { sourceName: this.owner.uName });
   }
   else {
      this.setWithRamp(_event.ramp, { sourceName: this.owner.uName });
   }
}

module.exports = exports = ScheduleProperty;
 
