var util = require('util');
var Property = require('../property');

function TopProperty(_config, _owner) {
   _config.allSourcesRequiredForValidity = false;

   Property.call(this, _config, _owner);
   this.sources = [];

   if (_config.hasOwnProperty('source')) {
      this.sources.push(this.sourceListeners[_config.source.name]);
   }
   else if (_config.hasOwnProperty('sources')) {

      for (var i = 0; i < _config.sources.length; ++i) {
         this.sources.push(this.sourceListeners[_config.sources[i].name];
      }
   }
}

util.inherits(TopProperty, Property);

TopProperty.prototype.newEventReceivedFromSource = function(_sourceListener, _data) {
   this.updatePropertyInternal(this.calculateOutputValue(), _data);
};

TopProperty.prototype.calculateOutputValue = function() {

   // top valid input
   for (var i = 0; i < this.sources.length; ++i) {

      if (this.sources[i] && this.sources[i].valid) {
         return this.sources[i].sourcePropertyValue;
      }
   }

   return false;
};

TopProperty.prototype.amIValid = function() {

   var ret = Property.prototype.amIValid.call(this);

   if (ret) {
      this.updatePropertyInternal(this.calculateOutputValue(), { sourceName: this.owner.uName });
   }

   return ret;
};

module.exports = exports = TopProperty;