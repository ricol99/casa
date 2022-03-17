var util = require('util');
var Property = require('../prop');

function InvertProperty(_config, _owner) {
   Property.call(this, _config, _owner);
}

util.inherits(InvertProperty, Property);

InvertProperty.prototype.newEventReceivedFromSource = function(_sourceListener, _data) {

   if (typeof _data.value === "boolean") {
      this.updatePropertyInternal(!_data.value, _data);
   }
   else if (typeof _data.value === "number") {
      this.updatePropertyInternal(-_data.value, _data);
   }
}

module.exports = exports = InvertProperty;
