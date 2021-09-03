var util = require('util');
var Event = require('../event');

function ServiceNodeEvent(_config, _owner) {
   Event.call(this, _config, _owner);
   this.serviceEventName = _config.serviceEventName;
}

util.inherits(ServiceNodeEvent, Event);

ServiceNodeEvent.prototype.receivedEventFromSource = function(_data) {

   if (this.sourceListeners[_data.sourceEventName] && (!(_data.hasOwnProperty("sourceService") && _data.sourceService === this.owner.uName))) {
      this.owner.eventReceivedFromSubscriber(this.serviceEventName, _data);
   }
};

module.exports = exports = ServiceNodeEvent;
 
