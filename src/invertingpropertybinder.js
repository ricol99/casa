var util = require('util');
var LogicPropertyBinder = require('./logicpropertybinder');

function InvertingPropertyBinder(_config, _owner) {

   LogicePropertyBinder.call(this, _config, _owner);

   var that = this;
   this.cStart = true;
}

util.inherits(InvertingPropertyBinder, LogicPropertyBinder);

InvertingPropertyBinder.prototype.setProperty = function(_propValue, _data, _callback) {
   this.updatePropertyAfterRead(!propValue, _data);
   _callback(true);
}

InvertingPropertyBinder.prototype.sourceIsActive = function(_data) {
   this.processSourceStateChange(true, _data);
}

InvertingPropertyBinder.prototype.sourceIsInactive = function(_data) {
   this.processSourceStateChange(false, _data);
}

InvertingPropertyBinder.prototype.processSourceStateChange = function(_active, _data) {
   this.updatePropertyAfterRead(!_active, _data);
}


module.exports = exports = InvertingPropertyBinder;
