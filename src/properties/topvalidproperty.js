var util = require('util');
var Property = require('../property');

function TopValidProperty(_config, _owner) {

   _config.allSourcesRequiredForValidity = false;
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

         if (sourceListener && (sourceListener.priority < highestPriorityFound) && sourceListener.valid) {
            highestPriorityFound = sourceListener.priority;
            highestPrioritySource = sourceListener;
         }
      }
   }

   return highestPrioritySource;
}

TopValidProperty.prototype.sourceIsValid = function(_data) {

   this.highestValidSource = findHighestPriorityValidSource(this);

   if (this.highestValidSource && (this.highestValidSource.sourcePropertyName != _data.sourcePropertyName)) {

      this.value = this.highestValidSource.getPropertyValue();
      _data.propertyValue = this.value;
      this.updatePropertyInternal(_data.propertyValue, _data);
   }

   Property.prototype.sourceIsValid.call(this, _data);
};

TopValidProperty.prototype.sourceIsInvalid = function(_data) {

   if (this.highestValidSource && (this.highestValidSource.sourcePropertyName == _data.sourcePropertyName)) {
      // Current output is based off a now invalid source - rescan
      var newHighestSource = findHighestPriorityValidSource(this);

      if (newHighestSource && (newHighestSource != this.highestValidSource)) {
         this.highestValidSource = newHighestSource;
         _data.propertyValue = this.highestValidSource.getPropertyValue();

         //if (_data.propertyValue != undefined) {
            this.updatePropertyInternal(_data.propertyValue, _data);
         //}
      }
      else {
         this.highestValidSource = newHighestSource;
      }
   }

   Property.prototype.sourceIsInvalid.call(this, _data);
}

TopValidProperty.prototype.newPropertyValueReceivedFromSource = function(_sourceListener, _data) {

   if (_sourceListener == this.highestValidSource) {
      this.updatePropertyInternal(_data.propertyValue, _data);
   }
};

module.exports = exports = TopValidProperty;
