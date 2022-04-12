var util = require('util');
var Property = require('../property');

function TopProperty(_config, _owner) {
   _config.allSourcesRequiredForValidity = false;

   Property.call(this, _config, _owner);
   this.sources = [];

   if (_config.hasOwnProperty('source')) {
      this.sources.push(this.sourceListeners[_config.source.uName]);
   }
   else if (_config.hasOwnProperty('sources')) {

      for (var i = 0; i < _config.sources.length; ++i) {
         this.sources.push(this.sourceListeners[_config.sources[i].uName];
      }
   }
}

util.inherits(TopProperty, Property);

// Called when system state is required
TopProperty.prototype.export = function(_exportObj) {
   Property.prototype.export.call(this, _exportObj);
};

// Called to restore system state before hot start
TopProperty.prototype.import = function(_importObj) {
   Property.prototype.import.call(this, _importObj);
};

// Called after system state has been restored
TopProperty.prototype.hotStart = function() {
   Property.prototype.hotStart.call(this);
};

// Called to start a cold system
TopProperty.prototype.coldStart = function () {
   Property.prototype.coldStart.call(this);
};

TopProperty.prototype.newEventReceivedFromSource = function(_sourceListener, _data) {
   var newValue = this.calculateOutputValue();
 
   if (newValue !== this.value) {
      this.updatePropertyInternal(newValue, _data);
   }
};

TopProperty.prototype.calculateOutputValue = function() {

   // top valid input
   for (var i = 0; i < this.sources.length; ++i) {

      if (this.sources[i] && this.sources[i].isValid()) {
         return this.sources[i].sourcePropertyValue;
      }
   }

   return false;
};

TopProperty.prototype.amIValid = function() {

   var ret = Property.prototype.amIValid.call(this);

   if (ret && !	this.cold) {
      var newValue = this.calculateOutputValue();

      if (newValue !== this.value) {
         this.updatePropertyInternal(newValue, { sourceName: this.owner.uName });
      }
   }

   return ret;
};

module.exports = exports = TopProperty;
