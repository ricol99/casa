var util = require('util');
var ListeningSource = require('./listeningsource');
var events = require('events');
var CasaSystem = require('./casasystem');

function DelayActivator(_config) {

   this.delay = (_config.delay) ? _config.delay : 0;
   this.delayedEvents = [];

   ListeningSource.call(this, _config);

   var that = this;
}

util.inherits(DelayActivator, ListeningSource);

DelayActivator.prototype.sourceIsActive = function(_data) {
   console.log('source ' + _data.sourceName + ' active!');
   this.delayEvents.add(new DelayedEvent(_data, true, this);
}

DelayActivator.prototype.sourceIsInactive = function(_data) {
   console.log('source ' + _data.sourceName + ' inactive!');
   this.delayEvents.add(new DelayedEvent(_data, false, this);
}

DelayActivator.prototype.deleteDelayedEvent = function(_delayedEvent) {
   // Delete first element in the array
   this.delayedEvents.splice(0,1);
}

function DelayedEvent(_eventData, _active, _activator) {
   this.eventData = _eventData;
   this.active = _active;
   this.activator = _activator;

   var that = this;
   this.timeoutObj = setTimeout(function() {

      if (that.active) {
         that.activator.goActive(that.eventData);
      }
      else {
         that.activator.goInActive(that.eventData);
      }
      that.activator.deleteDelayedEvent(that);
   }, this.delay*1000);
}

module.exports = exports = DelayActivator;
