var util = require('util');
var Property = require('../prop');

function EdgeProperty(_config, _owner) {
   Property.call(this, _config, _owner);

   if (_config.hasOwnProperty('leadingEdgeOutput')) {
      this.leadingEdgeOutput = _config.leadingEdgeOutput;
   }

   if (_config.hasOwnProperty('trailingEdgeOutput')) {
      this.trailingEdgeOutput = _config.trailingEdgeOutput;
   }
}

util.inherits(EdgeProperty, Property);

EdgeProperty.prototype.newEventReceivedFromSource = function(_sourceListener, _data) {

   if (this.value && !_data.value && this.hasOwnProperty('trailingEdgeOutput')) {
      this.updatePropertyInternal(this.trailingEdgeOutput, _data);
   }
   else if (!this.value && _data.value && this.hasOwnProperty('leadingEdgeOutput')) {
      this.updatePropertyInternal(this.leadingEdgeOutput, _data);
   }
}

module.exports = exports = EdgeProperty;
