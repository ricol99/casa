var util = require('util');
var MultiSourceListener = require('./multisourcelistener');
var SourceListener = require('./sourcelistener');

function PropertyBinder(_config, _owner) {
   this.name = _config.name;
   this.propertyName = _config.propertyName;
   this.ownerName = _owner.name;
   this.writeable = (_config.writeable) ? _config.writeable : true;
   this.owner = _owner;
   this.allSourcesRequiredForValidity = (_config.allSourcesRequiredForValidity) ? _config.allSourcesRequiredForValidity : false;
   this.captiveProperty = (_config.captiveProperty) ? _config.captiveProperty : true;
   this.allowMultipleSources = (_config.allowMultipleSources) ? _config.allowMultipleSources : false;
   this.defaultTriggerConditions = (_config.defaultTriggerConditions == undefined) ? false : _config.defaultTriggerConditions;

   this.binderEnabled = false;

   var that = this;

   this.sourceName = _config.source;

   if (this.allowMultipleSources && _config.sources) {
      console.log(this.name+': =============BBBB');

      if (this.captiveProperty) {
         // Don't allow the main property to be set from outside as we have mulitple sources we
         // are listening to and the property is captivated by these sources
      console.log(this.name+': =============CCCC');
         this.writeable = false;
      }

      this.binderEnabled = false;
      this.multiSourceListener = new MultiSourceListener({ name: this.name, sources: _config.sources, defaultTriggerConditions: this.defaultTriggerConditions,
                                                           allInputsRequiredForValidity: this.allSourcesRequiredForValidity }, this);
   }
   else if (_config.source) {

      if (this.captiveProperty) {
         // Don't allow the main property to be set from outside as we have a source we
         // are listening to and the property is captivated by that source
         this.writeable = false;
      }
      console.log(this.name+': =============AAAA');

      this.binderEnabled = false;
      this.sourceListener = new SourceListener(_config, this);
      this.source = this.sourceListener.source;
   }
   else {
      this.binderEnabled = true;
      this.mulitSourceListener = null;
      this.sourceListener = null;
   }

   var that = this;
}

// INTERNAL METHODS
PropertyBinder.prototype.myPropertyValue = function() {
   return this.owner.props[this.propertyName];
}

PropertyBinder.prototype.updatePropertyAfterRead = function(_propValue, _data) {
   this.owner.updateProperty(this.propertyName, _propValue, _data);
}

PropertyBinder.prototype.goInvalid = function(_data) {
   this.owner.goInvalid(this.propertyName, _data);
}

// Override this to actually update what ever the property is bound to
PropertyBinder.prototype.setProperty = function(_propValue, _data, _callback) {
   _callback(false);
}

PropertyBinder.prototype.sourceIsValid = function() {
   this.binderEnabled = true;
   this.source = (this.sourceListener) ? this.sourceListener.source : null;
}

PropertyBinder.prototype.sourceIsInvalid = function(_data) {
   console.log(this.name + ': INVALID');

   this.binderEnabled = false;
   this.source = null;
   this.goInvalid(_data);
}

// Methods to override
PropertyBinder.prototype.oneSourceIsActive = function(_sourceListener, _sourceAttributes, _data) {
   // DO NOTHING BY DEFAULT
}

PropertyBinder.prototype.oneSourceIsInactive = function(sourceListener, _sourceAttributes, _data) {
   // DO NOTHING BY DEFAULT
}

PropertyBinder.prototype.oneSourcePropertyChanged = function(sourceListener, _sourceAttributes, _data) {
   // DO NOTHING BY DEFAULT
}

PropertyBinder.prototype.sourceIsActive = function(_data) {
   // Copy functionality by default
   this.updatePropertyAfterRead(true, _data);
}

PropertyBinder.prototype.sourceIsInactive = function(_data) {
   // Copy functionality by default
   this.updatePropertyAfterRead(false, _data);
}

PropertyBinder.prototype.sourcePropertyChanged = function(_data) {
   // Copy functionality by default
   this.updatePropertyAfterRead(_data.propertyValue, _data);
}

// Override this if you listen to a source that is not "Source".
// If you listen to a "Source" you will be fired by that Source cold starting
PropertyBinder.prototype.coldStart = function(_data) {
   // DO NOTHING BY DEFAULT
}

module.exports = exports = PropertyBinder;
