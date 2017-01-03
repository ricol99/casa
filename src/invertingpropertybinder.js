var util = require('util');
var PropertyBinder = require('./propertybinder');

function InvertingPropertyBinder(_config, _owner) {
   PropertyBinder.call(this, _config, _owner);
}

util.inherits(InvertingPropertyBinder, PropertyBinder);

InvertingPropertyBinder.prototype.newPropertyValueReceivedFromSource = function(_sourceListener, _data) {

   if (typeof _data.propertyValue === "boolean") {
      this.updatePropertyAfterRead(!(_data.propertyValue), _data);
   }
   else if (typeof _data.propertyValue === "number") {
      this.updatePropertyAfterRead(-(_data.propertyValue), _data);
   }
}

module.exports = exports = InvertingPropertyBinder;
