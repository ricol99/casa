var util = require('util');
var Property = require('../property');

function DelayProperty(_config, _owner) {
   Property.call(this, _config, _owner);
   this.delay = (_config.delay) ? _config.delay : 0;
   this.delayedEvents = [];
}

util.inherits(DelayProperty, Property);

// Called when system state is required
DelayProperty.prototype.export = function(_exportObj) {

   if (Property.prototype.export.call(this, _exportObj)) {
      _exportObj.delay = this.delay;

      _exportObj.delayedEvents = util.copyMatch(this.delayedEvents, (_source, _prop) => {

         if (_prop === "owner") {
            return false;
         }
         else if (_prop === "timeoutObj") {
            return { replace: _source[_prop] ? _source[_prop].left() : -1 };
         }
         else if (_prop === "eventData") {
            return { replace: _source[_prop] ? util.copy(_source[_prop]) : null };
         }

         return true;
      });

      return true;
   }

   return false;
};

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

   this.timeoutObj = util.setTimeout( () => {
      this.timeoutObj = null;
      this.owner.updatePropertyInternal(this.value, this.eventData);
      this.owner.deleteDelayedEvent();
   }, this.owner.delay*1000);
}

module.exports = exports = DelayProperty;
