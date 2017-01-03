var util = require('util');
var PropertyBinder = require('./propertybinder');

function TopValidPropertyBinder(_config, _owner) {

   _config.allInputsRequiredForValidity = false;
   PropertyBinder.call(this, _config, _owner);

   this.highestValidSource = null;
}

util.inherits(TopValidPropertyBinder, PropertyBinder);

function findHighestPriorityValidSource(_this) {
   var highestPriorityFound = 99999;
   var highestPrioritySource = null;

   for (var sourcePropertyName in _this.sourceListeners) {

      if (_this.sourceListeners.hasOwnProperty(sourcePropertyName)){
         var sourceListener = _this.sourceListeners[sourcePropertyName];

         if (sourceListener && (sourceListener.priority < highestPriorityFound) && sourceListener.sourceListenerEnabled) {
            highestPriorityFound = sourceListener.priority;
            highestPrioritySource = sourceListener;
         }
      }
   }

   return highestPrioritySource;
}

TopValidPropertyBinder.prototype.newPropertyValueReceivedFromSource = function(_sourceListener, _data) {

   this.highestValidSource = findHighestPriorityValidSource(this);

   if (_sourceListener == this.highestValidSource) {
      this.updatePropertyAfterRead(data.propertyValue, _data);
   }
};

module.exports = exports = TopValidPropertyBinder;
