var util = require('util');
var PropertyBinder = require('./propertybinder');

function MultiLogicPropertyBinder(_config, _owner) {

   _config.allowMultipleSources = true;
   _config.defaultTriggerConditions = true;

   PropertyBinder.call(this, _config, _owner);
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

MultiLogicPropertyBinder.prototype.getOutputValue = function(_active, _sourceAttributes) {

   if (_active) {
      return (_sourceAttributes.outputActiveValue == undefined) ? true : _sourceAttributes.outputActiveValue;
   }
   else {
      return (_sourceAttributes.outputInactiveValue == undefined) ? false : _sourceAttributes.outputInactiveValue;
   }
}

MultiLogicPropertyBinder.prototype.processSourceStateChange = function(_active, _sourceListener, _sourceAttributes, _data) {
   var outputShouldGoActive = this.checkActivate();
   var highestPrioritySource = this.findHighestPrioritySource(outputShouldGoActive);

   if (!highestPrioritySource) {
      highestPrioritySource = _sourceAttributes;
   }

   if (this.myPropertyValue()) {

      if (outputShouldGoActive) {

         // Already active so check priority
         if (highestPrioritySource.priority >= _sourceAttributes.priority) {
            this.updatePropertyAfterRead(this.getOutputValue(true, highestPrioritySource), highestPrioritySource.activeData);
         }
      }
      else {
         this.updatePropertyAfterRead(this.getOutputValue(false, highestPrioritySource), highestPrioritySource.inactiveData);
      }
   }
   else {
      if (!outputShouldGoActive) {

         // Already inactive so check priority
         if (highestPrioritySource.priority >= _sourceAttributes.priority) {
            this.updatePropertyAfterRead(this.getOutputValue(false, highestPrioritySource), highestPrioritySource.inactiveData);
         }
      }
      else {
         this.updatePropertyAfterRead(this.getOutputValue(true, highestPrioritySource), highestPrioritySource.activeData);
      }
   }
}

// Override this with required logic behaviour
MultiLogicPropertyBinder.prototype.checkActivate = function() {
   return false;
}

module.exports = exports = MultiLogicPropertyBinder;
