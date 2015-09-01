var util = require('util');
var PropertyBinder = require('./propertybinder');

function MultiLogicPropertyBinder(_config, _owner) {

   _config.allowMultipleSources = true;
   _config.defaultTriggerConditions = true;
   PropertyBinder.call(this, _config, _owner);

   var that = this;
}

util.inherits(MultiLogicPropertyBinder, PropertyBinder);

MultiLogicPropertyBinder.prototype.oneSourceIsActive = function(_sourceListener, _sourceAttributes, _data) {
   console.log(this.name + ': Input source ' + _data.sourceName + ' has changed property ' + _data.propertyName + ' to true!');
   this.processSourceStateChange(true, _sourceListener, _sourceAttributes, _data);
}

MultiLogicPropertyBinder.prototype.oneSourceIsInactive = function(_sourceListener, _sourceAttributes, _data) {
   console.log(this.name + ': Input source ' + _data.sourceName + ' has changed property ' + _data.propertyName + ' to false!');
   this.processSourceStateChange(false, _sourceListener, _sourceAttributes, _data);
}

MultiLogicPropertyBinder.prototype.findHighestPrioritySource = function(_outputActive) {
   var highestPriorityFound = 99999;
   var highestPrioritySource = null;


   for (var prop in this.multiSourceListener.sourceAttributes) {

      if(this.multiSourceListener.sourceAttributes.hasOwnProperty(prop)){
         var sourceAttribs = this.multiSourceListener.sourceAttributes[prop];

         if (sourceAttribs && (sourceAttribs.priority < highestPriorityFound) && (sourceAttribs.active == _outputActive)) {
            highestPriorityFound = sourceAttribs.priority;
            highestPrioritySource = sourceAttribs;
         }
      }
   }

   return highestPrioritySource;
}

MultiLogicPropertyBinder.prototype.processSourceStateChange = function(_active, _sourceListener, _sourceAttributes, _data) {
   var outputShouldGoActive = this.checkActivate();
   var highestPrioritySource = this.findHighestPrioritySource(outputShouldGoActive);

   if (!highestPrioritySource) {
      //highestPriorityInput = { source: _input, activeData: { sourceName: _input.name }, inactiveData: { sourceName: _input.name }, priority: 0 };
      highestPrioritySource = _sourceAttributes;
   }

   if (this.myPropertyValue()) {

      if (outputShouldGoActive) {

         // Already active so check priority
         if (highestPrioritySource.priority >= _sourceAttributes.priority) {
            this.updatePropertyAfterRead(true, highestPrioritySource.activeData);
         }
      }
      else {
         this.updatePropertyAfterRead(false, highestPrioritySource.inactiveData);
      }
   }
   else {
      if (!outputShouldGoActive) {

         // Already inactive so check priority
         if (highestPrioritySource.priority >= _sourceAttributes.priority) {
            this.updatePropertyAfterRead(false, highestPrioritySource.inactiveData);
         }
      }
      else {
         this.updatePropertyAfterRead(true, highestPrioritySource.activeData);
      }
   }
}

// Override this with required logic behaviour
MultiLogicPropertyBinder.prototype.checkActivate = function() {
   return false;
}

module.exports = exports = MultiLogicPropertyBinder;
