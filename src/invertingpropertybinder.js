var util = require('util');
var PropertyBinder = require('./propertybinder');

function InvertingPropertyBinder(_config, _owner) {

   this.minOutputTime = (_config.minOutputTime) ? _config.minOutputTime : 0;

   PropertyBinder.call(this, _config, _owner);

   var that = this;
   this.cStart = true;
}

util.inherits(InvertingPropertyBinder, PropertyBinder);

InvertingPropertyBinder.prototype.setProperty = function(_propValue, _data, _callback) {
   this.updatePropertyAfterRead(!propValue, _data);
   _callback(true);
}

InvertingPropertyBinder.prototype.sourcePropertyChanged = function(_data) {
   this.updatePropertyAfterRead(!_data.propertyValue, _data);
}


module.exports = exports = InvertingPropertyBinder;
