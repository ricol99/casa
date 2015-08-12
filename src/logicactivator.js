var util = require('util');
var MultiListeningSource = require('./multilisteningsource');

function LogicActivator(_config) {

   MultiListeningSource.call(this, _config);

   this.active = false;

   var that = this;
}

util.inherits(LogicActivator, MultiListeningSource);

LogicActivator.prototype.oneSourceIsActive = function(_data, _input) {
   console.log(this.name + ': Input source ' + _data.sourceName + ' active!');
   this.emitIfNecessary(this.inputs[_data.sourceName]);
}

LogicActivator.prototype.oneSourceIsInactive = function(_data, _input) {
   console.log(this.name + ' : Input source ' + _data.sourceName + ' inactive!');
   this.emitIfNecessary(_input);
}

LogicActivator.prototype.findHighestPriorityInput = function(_outputActive) {
   var highestPriorityFound = 99999;
   var highestPriorityInput = null;


   for(var prop in this.inputs) {

      if(this.inputs.hasOwnProperty(prop)){
         var input = this.inputs[prop];

         if (input && input.priority < highestPriorityFound && input.active == _outputActive) {
            highestPriorityFound = input.priority;
            highestPriorityInput = input;
         }
      }
   }

   return highestPriorityInput;
}

LogicActivator.prototype.emitIfNecessary = function(_input) {
   var outputShouldGoActive = this.checkActivate();
   var highestPriorityInput = this.findHighestPriorityInput(outputShouldGoActive);

   if (!highestPriorityInput) {
      //highestPriorityInput = { source: _input, activeData: { sourceName: _input.name }, inactiveData: { sourceName: _input.name }, priority: 0 };
      highestPriorityInput = _input;
   }

   if (this.active) {

      if (outputShouldGoActive) {
         // Already active so check priority
         if (highestPriorityInput.priority >= _input.priority) {
            this.goActive(highestPriorityInput.activeData);
         }
      }
      else {
         this.goInactive(highestPriorityInput.inactiveData);
      }
   }
   else {
      if (!outputShouldGoActive) {
         // Already inactive so check priority
         if (highestPriorityInput.priority >= _input.priority) {
            this.goInactive(highestPriorityInput.inactiveData);
         }
      }
      else {
         this.goActive(highestPriorityInput.activeData);
      }
   }
}

module.exports = exports = LogicActivator;
