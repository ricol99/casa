var util = require('util');
var MultiListeningSource = require('./multilisteningsource');

function LogicActivator(_config) {

   MultiListeningSource.call(this, _config);

   var that = this;
}

util.inherits(LogicActivator, MultiListeningSource);

LogicActivator.prototype.oneSourceIsActive = function(_data, _sourceListener, _sourceAttributes) {
   console.log(this.name + ': Input source ' + _data.sourceName + ' active!');
   this.emitIfNecessary(_sourceListener, _sourceAttributes);
}

LogicActivator.prototype.oneSourceIsInactive = function(_data, _sourceListener, _sourceAttributes) {
   console.log(this.name + ' : Input source ' + _data.sourceName + ' inactive!');
   this.emitIfNecessary(_sourceListener, _sourceAttributes);
}

LogicActivator.prototype.findHighestPrioritySource = function(_outputActive) {
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

LogicActivator.prototype.emitIfNecessary = function(_sourceListener, _sourceAttributes) {
   var outputShouldGoActive = this.checkActivate();
   var highestPrioritySource = this.findHighestPrioritySource(outputShouldGoActive);

   if (!highestPrioritySource) {
      //highestPriorityInput = { source: _input, activeData: { sourceName: _input.name }, inactiveData: { sourceName: _input.name }, priority: 0 };
      highestPrioritySource = _sourceAttributes;
   }

   if (this.active) {

      if (outputShouldGoActive) {

         // Already active so check priority
         if (highestPrioritySource.priority >= _sourceAttributes.priority) {
            this.goActive(highestPrioritySource.activeData);
         }
      }
      else {
         this.goInactive(highestPrioritySource.inactiveData);
      }
   }
   else {
      if (!outputShouldGoActive) {

         // Already inactive so check priority
         if (highestPrioritySource.priority >= __sourceAttributes.priority) {
            this.goInactive(highestPrioritySource.inactiveData);
         }
      }
      else {
         this.goActive(highestPrioritySource.activeData);
      }
   }
}

module.exports = exports = LogicActivator;
