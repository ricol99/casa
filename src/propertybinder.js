var util = require('util');
var SourceListener = require('./sourcelistener');

function PropertyBinder(_config, _source) {
   this.name = _config.name;
   this.propertyName = _config.propertyName;
   this.writeable = _config.writeable;
   this.sourceName = _source.name;
   this.source = _source;

   var that = this;

   if (_config.target) {
      this.targetConfig = { source: _config.target, sourceProperty: _config.targetProperty,
                            triggerCondition: _config.triggerCondition, triggerValue: _config.triggerValue };

      this.targetListener = new SourceListener(this.targetConfig, this);
      this.target = this.targetListener.source;
      this.targetEnabled = (this.target != null);
   }
   else {
      this.targetEnabled = false;
      this.target = null;
   }
}

// INTERNAL METHODS
PropertyBinder.prototype.myPropertyValue = function() {
   return this.source.props[this.propertyName];
}

PropertyBinder.prototype.updatePropertyAfterRead = function(_propValue, _data) {
   this.source.updateProperty(this.propertyName, _propValue, _data);
}

// Override this to actually update what ever the property is bound to
PropertyBinder.prototype.setProperty = function(_propValue, _data, _callback) {
   _callback(false);
}

PropertyBinder.prototype.sourceIsValid = function() {
   this.targetEnabled = true;

   // Cope with constructor calling back so sourceListener is not yet defined!
   if (this.targetListener) {
     this.target = this.targetListener.source;
   }
}

PropertyBinder.prototype.sourceIsInvalid = function(_data) {
   console.log(this.name + ': INVALID');

   this.targetEnabled = false;
   this.target = null;
}

PropertyBinder.prototype.sourceIsActive = function(_data) {
   // DO NOTHING BY DEFAULT
}

PropertyBinder.prototype.sourceIsInactive = function(_data) {
   // DO NOTHING BY DEFAULT
}

PropertyBinder.prototype.sourcePropertyChanged = function(_data) {

   if (this.target && _data.sourceName == this.target.name) {

      if (this.targetConfig.sourceProperty == _data.propertyName) {
         this.targetPropertyChanged(_data);
      }
   }
}

PropertyBinder.prototype.targetPropertyChanged = function(_data) {
   // DO NOTHING BY DEFAULT
}

module.exports = exports = PropertyBinder;
