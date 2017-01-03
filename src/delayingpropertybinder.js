var util = require('util');
var PropertyBinder = require('./propertybinder');

function DelayingPropertyBinder(_config, _owner) {

   this.delay = (_config.delay) ? _config.delay : 0;
   this.delayedEvents = [];

   PropertyBinder.call(this, _config, _owner);

   var that = this;
}

util.inherits(DelayingPropertyBinder, PropertyBinder);

DebouncingPropertyBinder.prototype.newPropertyValueReceivedFromSource = function(_sourceListener, _data) {
   console.log('source ' + _data.sourceName + ' has changed property ' + _data.propertyName + ' to ' + _data.propertyValue + '!');
   this.delayEvents.add(new DelayedEvent(_data, _data.propertyValue, this);
}

DelayingPropertyBinder.prototype.deleteDelayedEvent = function(_delayedEvent) {
   // Delete first element in the array
   this.delayedEvents.splice(0,1);
}

function DelayedEvent(_eventData, _value, _binder) {
   this.eventData = _eventData;
   this.value = _value;
   this.binder = _binder;

   var that = this;
   this.timeoutObj = setTimeout(function() {
      that.updatePropertyAfterRead(that.value, that.eventData);
   }, this.delay*1000);
}

module.exports = exports = DelayingPropertyBinder;
