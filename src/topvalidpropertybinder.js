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

         if (sourceListener) {
            console.info(_this.name + ": AAAAAAAAAAAAAA Source Listener " + sourceListener.name + ", Priority: " + sourceListener.priority + " Enabled: " + sourceListener.sourceListenerEnabled);
         }

         if (sourceListener && (sourceListener.priority < highestPriorityFound) && sourceListener.sourceListenerEnabled) {
            highestPriorityFound = sourceListener.priority;
            highestPrioritySource = sourceListener;
            console.info(_this.name + ": BBBBBBBBBBBBB Highest Priority Source: " + highestPrioritySource.name + ", Priority: " + highestPriorityFound);
         }
      }
   }

   return highestPrioritySource;
}

TopValidPropertyBinder.prototype.sourceIsInvalid = function(_data) {

   if (this.highestValidSource && (this.highestValidSource.sourcePropertyName == _data.sourcePropertyName)) {
      // Current output is based off a now invalid source - rescan
      this.highestValidSource = findHighestPriorityValidSource(this);

      if (this.highestValidSource) {
         this.updatePropertyAfterRead(this.highestValidSource.getPropertyValue(), { sourceName: this.owner.name });
      }
   }

   PropertyBinder.prototype.sourceIsInvalid.call(this, _data);
}

TopValidPropertyBinder.prototype.newPropertyValueReceivedFromSource = function(_sourceListener, _data) {
   console.info(this.name + ": WWWWWWWWWWWWWWWWWWW ", _data);

   this.highestValidSource = findHighestPriorityValidSource(this);
   console.info(this.name + ": VVVVVVVVVVVVVVVVVV source = "+ _sourceListener.name + ", highest source = "+this.highestValidSource.name);

   if (_sourceListener == this.highestValidSource) {
      this.updatePropertyAfterRead(_data.propertyValue, _data);
      console.info(this.name + ": CCCCCCCCCCCCCCCCCCC Property Value " + _data.propertyValue);
   }
};

module.exports = exports = TopValidPropertyBinder;