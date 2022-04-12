var util = require('util');
var Property = require('../property');

function InvertProperty(_config, _owner) {
   Property.call(this, _config, _owner);
}

util.inherits(InvertProperty, Property);

// Called when system state is required
InvertProperty.prototype.export = function(_exportObj) {
   Property.prototype.export.call(this, _exportObj);
};

// Called to restore system state before hot start
InvertProperty.prototype.import = function(_importObj) {
   Property.prototype.import.call(this, _importObj);
};

// Called after system state has been restored
InvertProperty.prototype.hotStart = function() {
   Property.prototype.hotStart.call(this);
};

// Called to start a cold system
InvertProperty.prototype.coldStart = function () {
   Property.prototype.coldStart.call(this);
};

InvertProperty.prototype.newEventReceivedFromSource = function(_sourceListener, _data) {

   if (typeof _data.value === "boolean") {
      this.updatePropertyInternal(!_data.value, _data);
   }
   else if (typeof _data.value === "number") {
      this.updatePropertyInternal(-_data.value, _data);
   }
}

module.exports = exports = InvertProperty;
