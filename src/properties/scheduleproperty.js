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

   this.events = [];

   this.scheduleService.registerEvents(this, _config.events);

   var ret = this.scheduleService.getInitialValue(this);

   if (ret.initialValueFound) {
      this.initialValueSet = true;
      this.value = ret.value;
   }
   else {
      console.error(this.uName+": No initial value set for schedule property");
   }
}

util.inherits(ScheduleProperty, Property);

// Called when system state is required
ScheduleProperty.prototype.export = function(_exportObj) {
   Property.prototype.export.call(this, _exportObj);
};

// Called to restore system state before hot start
ScheduleProperty.prototype.import = function(_importObj) {
   Property.prototype.import.call(this, _importObj);
};

// Called after system state has been restored
ScheduleProperty.prototype.hotStart = function() {
   Property.prototype.hotStart.call(this);
};

// Called to start a cold system
ScheduleProperty.prototype.coldStart = function () {
   Property.prototype.coldStart.call(this);
};

ScheduleProperty.prototype.scheduledEventTriggered = function(_event) {
   this.owner.newScheduledTransaction();

   if (_event.hasOwnProperty("value")) {
      this.updatePropertyInternal(_event.value, { sourceName: this.owner.uName });
   }
   else {
      this.setWithRamp(_event.ramp, { sourceName: this.owner.uName });
   }
}

module.exports = exports = ScheduleProperty;
 
