var util = require('util');
var Property = require('../prop');

function CounterProperty(_config, _owner) {
   Property.call(this, _config, _owner);
}

util.inherits(CounterProperty, Property);

CounterProperty.prototype.newEventReceivedFromSource = function(_sourceListener, _data) {
   this.updatePropertyInternal(this.value+1, _data);
}

module.exports = exports = CounterProperty;
