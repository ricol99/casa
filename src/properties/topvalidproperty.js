var util = require('util');
var Property = require('../property');

function TopValidProperty(_config, _owner) {

   _config.allSourcesRequiredForValidity = false;
   Property.call(this, _config, _owner);

   this.highestValidSource = null;
}

util.inherits(TopValidProperty, Property);

// Called when system state is required
TopValidProperty.prototype.export = function(_exportObj) {
   Property.prototype.export.call(this, _exportObj);
};

// Called to restore system state before hot start
TopValidProperty.prototype.import = function(_importObj) {
   Property.prototype.import.call(this, _importObj);
};

// Called after system state has been restored
TopValidProperty.prototype.hotStart = function() {
   Property.prototype.hotStart.call(this);
   this.highestValidSource = findHighestPriorityValidSource(this);
};

// Called to start a cold system
TopValidProperty.prototype.coldStart = function () {
   Property.prototype.coldStart.call(this);
};

function findHighestPriorityValidSource(_this) {
   var highestPriorityFound = 99999;
   var highestPrioritySource = null;

   for (var sourceEventName in _this.sourceListeners) {

      if (_this.sourceListeners.hasOwnProperty(sourceEventName)){
         var sourceListener = _this.sourceListeners[sourceEventName];

         if (sourceListener && (sourceListener.priority < highestPriorityFound) && sourceListener.isValid()) {
            highestPriorityFound = sourceListener.priority;
            highestPrioritySource = sourceListener;
         }
      }
   }

   return highestPrioritySource;
}

TopValidProperty.prototype.sourceIsValid = function(_data) {
   var oldHighestSource = this.highestValidSource;

   this.highestValidSource = findHighestPriorityValidSource(this);

   if (this.highestValidSource && (oldHighestSource != this.highestValidSource)) {
   //if (this.highestValidSource && (this.highestValidSource.sourceEventName != _data.sourceEventName)) {

      this.value = this.highestValidSource.getPropertyValue();
      _data.value = this.value;
      this.updatePropertyInternal(_data.value, _data);
   }

   Property.prototype.sourceIsValid.call(this, _data);
};

TopValidProperty.prototype.sourceIsInvalid = function(_data) {

   if (this.highestValidSource && (this.highestValidSource.sourceEventName == _data.sourceEventName)) {

      // Current output is based off a now invalid source - rescan
      var newHighestSource = findHighestPriorityValidSource(this);

      if (newHighestSource && (newHighestSource != this.highestValidSource)) {
         this.highestValidSource = newHighestSource;
         _data.value = this.highestValidSource.getPropertyValue();
         this.updatePropertyInternal(_data.value, _data);
      }
      else {
         this.highestValidSource = newHighestSource;
      }
   }

   if (!this.highestValidSource) {
      Property.prototype.sourceIsInvalid.call(this, _data);
   }
}

TopValidProperty.prototype.newEventReceivedFromSource = function(_sourceListener, _data) {

   if (_sourceListener == this.highestValidSource) {
      this.updatePropertyInternal(_data.value, _data);
   }
};

module.exports = exports = TopValidProperty;
