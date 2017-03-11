var util = require('util');
var Step = require('../step');

function DelayStep(_config, _pipeline) {

   this.delay = (_config.delay) ? _config.delay : 0;
   this.delayedEvents = [];

   Step.call(this, _config, _pipeline);
}

util.inherits(DelayStep, Step);

// Called by Property or previous Step
// Steps should derive from this to process new input
// Call outputForNextStep() to pass on output to next step (when required)
//
InvertStep.prototype.process = function(_value, _data) {
   console.log('source ' + _data.sourceName + ' has changed property ' + _data.propertyName + ' to ' + _value + '!');
   this.delayEvents.push(new DelayedEvent(_value, _data, this);
}

DelayStep.prototype.deleteDelayedEvent = function() {
   // Delete first element in the array
   this.delayedEvents = this.delayedEvents.splice(0,1);
}

function DelayedEvent(_value, _eventData, _step) {
   this.value = _value;
   this.eventData = copyData(_eventData);
   this.step = _step;

   this.timeoutObj = setTimeout(function(_that) {
      _that.step.outputForNextStep(_that.value, _that.eventData);
      _that.step.deleteDelayedEvent();
   }, this.step.delay*1000, this);
}

function copyData(_sourceData) {
   var newData = {};

   for (var prop in _sourceData) {

      if (_sourceData.hasOwnProperty(prop)){
         newData[prop] = _sourceData[prop];
      }
   }

   return newData;
}

module.exports = exports = DelayStep;
