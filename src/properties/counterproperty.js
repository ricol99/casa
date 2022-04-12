var util = require('util');
var Property = require('../property');

function CounterProperty(_config, _owner) {
   Property.call(this, _config, _owner);
}

util.inherits(CounterProperty, Property);

// Called when current state required
CounterProperty.prototype.export = function(_exportObj) {
   Property.prototype.export.call(this, _exportObj);
};

// Called to retsore current state
CounterProperty.prototype.import = function(_importObj) {
   Property.prototype.import.call(this, _importObj);
};

CounterProperty.prototype.coldStart = function() {
   Property.prototype.coldStart.call(this);
};

CounterProperty.prototype.hotStart = function() {
   Property.prototype.hotStart.call(this);
};

CounterProperty.prototype.newEventReceivedFromSource = function(_sourceListener, _data) {
   this.updatePropertyInternal(this.value+1, _data);
}

module.exports = exports = CounterProperty;
