var util = require('util');

function PropertyBinder(_config, _source) {
   this.name = _config.name;
   this.propertyName = _config.propertyName;
   this.writeable = _config.writeable;
   this.sourceName = _source.name;
   this.source = _source;

   var that = this;
}

// INTERNAL METHOD
PropertyBinder.prototype.updatePropertyAfterRead = function(_propValue) {
   this.source.updateProperty(this.propertyName, _propValue);
}

// Override this to actually update what ever the property is bound to
PropertyBinder.prototype.setProperty = function(_propValue, _callback) {
   _callback(false);
}

module.exports = exports = PropertyBinder;
