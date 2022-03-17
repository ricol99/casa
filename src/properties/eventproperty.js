var util = require('util');
var Property = require('../property');

function EventProperty(_config, _owner) {
   Property.call(this, _config, _owner);

   if (_config.hasOwnProperty("eventMap")) {
      this.eventMap = util.copy(_config.eventMap);
   }
}

util.inherits(EventProperty, Property);

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
