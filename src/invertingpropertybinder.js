var util = require('util');
var PropertyBinder = require('./propertybinder');

function InvertingPropertyBinder(_config, _owner) {
   PropertyBinder.call(this, _config, _owner);
}

util.inherits(InvertingPropertyBinder, PropertyBinder);

InvertingPropertyBinder.prototype.calculateNewOutputValue = function(_sourceListener, _data, _callback) {

   if (typeof _data.propertyValue === "boolean") {
      return _callback(null, !(_data.propertyValue));

   }
   else if (typeof _data.propertyValue === "number") {
      return _callback(null, -(_data.propertyValue));
   }
}

module.exports = exports = InvertingPropertyBinder;
