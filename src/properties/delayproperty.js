var util = require('util');
var Property = require('../property');

function DelayProperty(_config, _owner) {
   Property.call(this, _config, _owner);
   this.delay = (_config.delay) ? _config.delay : 0;
   this.delayedEvents = [];
}

util.inherits(DelayProperty, Property);

DelayProperty.prototype.newEventReceivedFromSource = function(_sourceListener, _data) {
   this.delayedEvents.push(new DelayedEvent(_data.value, _data, this));
}

DelayProperty.prototype.deleteDelayedEvent = function() {
   // Delete first element in the array
   let event = this.delayedEvents.shift();
}

function DelayedEvent(_value, _eventData, _owner) {
   this.value = _value;
   this.eventData = util.copy(_eventData);
   this.owner = _owner;

   this.timeoutObj = setTimeout( () => {
      this.owner.updatePropertyInternal(this.value, this.eventData);
      this.owner.deleteDelayedEvent();
   }, this.owner.delay*1000);
}

module.exports = exports = DelayProperty;
