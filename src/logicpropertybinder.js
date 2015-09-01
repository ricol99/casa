var util = require('util');
var PropertyBinder = require('./propertybinder');

function LogicPropertyBinder(_config, _owner) {
   _config.defaultTriggerConditions = true;

   PropertyBinder.call(this, _config, _owner);

   var that = this;
}

util.inherits(LogicPropertyBinder, PropertyBinder);

// Override these methods
LogicPropertyBinder.prototype.setProperty = function(_propValue, _data, _callback) {
   this.updatePropertyAfterRead(!propValue, _data);
   _callback(true);
}

LogicPropertyBinder.prototype.sourceIsActive = function(_data) {
}

LogicPropertyBinder.prototype.sourceIsInactive = function(_data) {
}

// Do not override this
LogicPropertyBinder.prototype.sourcePropertyChanged = function(_data) {
}

module.exports = exports = LogicPropertyBinder;
