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

// Called to restore system state before hot start
DeleyProperty.prototype.import = function(_importObj) {
   Property.prototype.import.call(this, _importObj)) {
   
   for (var i = 0; i < _importObj.delayedEvents.length; ++i) {
      this.delayedEvents.push({ owner: this, timeoutObj: _importObj.delayedEvents[i].timeoutObj, eventData: util.copy(_importObj.delayedEvents[i].eventData) });
   }
};

// Called after system state has been restored 
DelayProperty.prototype.hotStart = function() {
   Property.prototype.hotStart.call(this);
   
   for (var i = 0; i < this.delayedEvents.length; ++i) {
      this.delayedEvents[i] = new DelayedEvent(this.delayedEvents[i].eventData.value, this.delayedEvents[i].eventData, this, (this.delayedEvents[i].timeoutObj === -1) ? null : this.delayedEvents[i].timeoutObj);
   }
};


DelayProperty.prototype.newEventReceivedFromSource = function(_sourceListener, _data) {
   this.delayedEvents.push(new DelayedEvent(_data.value, _data, this));
}

DelayProperty.prototype.deleteDelayedEvent = function() {
   // Delete first element in the array
   let event = this.delayedEvents.shift();
}

function DelayedEvent(_value, _eventData, _owner, _overrideTimeout) {
   this.value = _value;
   this.eventData = util.copy(_eventData);
   this.owner = _owner;
   var delay = _overrideTimeout ? _overrideTimeout : this.owner.delay*1000;

   this.timeoutObj = util.setTimeout( () => {
      this.timeoutObj = null;
      this.owner.updatePropertyInternal(this.value, this.eventData);
      this.owner.deleteDelayedEvent();
   }, delay);
}

module.exports = exports = DelayProperty;
