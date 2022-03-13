var util = require('util');
var Property = require('../property');
var Gang = require('../gang');

function ScheduleProperty(_config, _owner) {

   Property.call(this, _config, _owner);

   this.gang = Gang.mainInstance();
   this.scheduleService = this.gang.casa.findService("scheduleservice");

   if (!this.scheduleService) {
      console.error(this.uName + ": ***** Schedule service not found! *************");
      process.exit(1);
   }

   this.writable = false;
   this.events = [];

   this.scheduleService.registerEvents(this, _config.events);

   var ret = this.scheduleService.getInitialValue(this);

   if (ret.initialValueFound) {
      this.value = ret.value;
   }
}

util.inherits(ScheduleProperty, Property);

// Called when system state is required
ScheduleProperty.prototype.export = function(_exportObj) {

   if (Property.prototype.export.call(this, _exportObj)) {
      _exportObj.events = this.events;
      return true;
   }

   return false;
};

ScheduleProperty.prototype.scheduledEventTriggered = function(_event) {

   if (_event.hasOwnProperty("value")) {
      this.updatePropertyInternal(_event.value, { sourceName: this.owner.uName });
   }
   else {
      this.setWithRamp(_event.ramp, { sourceName: this.owner.uName });
   }
}

module.exports = exports = ScheduleProperty;
 
