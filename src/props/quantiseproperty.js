var util = require('util');
var Property = require('../prop');

function QuantiseProperty(_config, _owner) {
   Property.call(this, _config, _owner);
   this.quanta = _config.quanta;
   this.boundaries = [];

   for (var q in this.quanta) {
      this.boundaries.push({ name: q, value: this.quanta[q] });
   }

   this.boundaries.sort((_a, _b) => {
      return _a.value - _b.value;
   });
}

util.inherits(QuantiseProperty, Property);

QuantiseProperty.prototype.newEventReceivedFromSource = function(_sourceListener, _data) {
   var name = this.boundaries[0].name;

   for (var q = 0; q < this.boundaries.length; ++q) {

      if (_data.value >= this.boundaries[q].value) {
         name = this.boundaries[q].name;
      }
      else {
         break;
      }
   }

   this.updatePropertyInternal(name, _data);
}

module.exports = exports = QuantiseProperty;
