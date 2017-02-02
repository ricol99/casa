var util = require('util');
var Property = require('./property');

function TopValidProperty(_config, _owner) {

   _config.allInputsRequiredForValidity = false;
   Property.call(this, _config, _owner);

   this.highestValidSource = null;
}

util.inherits(TopValidProperty, Property);

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

TopValidProperty.prototype.sourceIsInvalid = function(_data) {

   if (this.highestValidSource && (this.highestValidSource.sourcePropertyName == _data.sourcePropertyName)) {
      // Current output is based off a now invalid source - rescan
      this.highestValidSource = findHighestPriorityValidSource(this);

      if (this.highestValidSource) {
         this.updatePropertyInternal(this.highestValidSource.getPropertyValue());
      }
   }

   Property.prototype.sourceIsInvalid.call(this, _data);
}

TopValidProperty.prototype.newPropertyValueReceivedFromSource = function(_sourceListener, _data) {

   this.highestValidSource = findHighestPriorityValidSource(this);

   if (_sourceListener == this.highestValidSource) {
      this.updatePropertyInternal(_data.propertyValue, _data);
   }
};

module.exports = exports = TopValidProperty;
