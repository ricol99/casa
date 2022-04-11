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

// Called when current state required
Alarm.prototype.export = function(_exportObj) {
   Thing.prototype.export.call(this, _exportObj);
};

// Called when current state required
Alarm.prototype.import = function(_importObj) {
   Thing.prototype.import.call(this, _importObj);
};

Alarm.prototype.hotStart = function() {
   Thing.prototype.hotStart.call(this);
};

Alarm.prototype.coldStart = function() {
   Thing.prototype.coldStart.call(this);
   this.alignProperty('ACTIVE', true);
};

Alarm.prototype.scheduledEventTriggered = function(_event) {

   if (this.getProperty('ACTIVE') {

      if (_event.hasOwnProperty("value")) {
         this.raiseEvent(_event.name, { sourceName: this.uName, value: _event.value });
      }
      else {
         this.raiseEvent(_event.name, { sourceName: this.uName });
      }
   }
}

module.exports = exports = Alarm;
