var util = require('util');
var Property = require('../property');

function EventProperty(_config, _owner) {
   Property.call(this, _config, _owner);

   if (_config.hasOwnProperty("eventMap")) {
      this.eventMap = util.copy(_config.eventMap);
   }
}

util.inherits(EventProperty, Property);

// Called when system state is required
EventProperty.prototype.export = function(_exportObj) {
   Property.prototype.export.call(this, _exportObj);
};

// Called to restore system state before hot start
EventProperty.prototype.import = function(_importObj) {
   Property.prototype.import.call(this, _importObj);
};

// Called after system state has been restored
EventProperty.prototype.hotStart = function() {
   Property.prototype.hotStart.call(this);
};

// Called to start a cold system
EventProperty.prototype.coldStart = function () {
   Property.prototype.coldStart.call(this);
};

EventProperty.prototype.propertyAboutToChange = function(_actualOutputValue, _data) {

   if (_data.coldStart) {
      return;
   }

   if (this.eventMap) {

      if (this.eventMap[_actualOutputValue]) {
         this.owner.raiseEvent(this.eventMap[_actualOutputValue], _data);
      }
   }
   else {
      this.owner.raiseEvent(_actualOutputValue, _data);
   }
};


module.exports = exports = EventProperty;
