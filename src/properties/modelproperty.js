var util = require('../util');
var Property = require('../property');

function ModelProperty(_config, _owner) {
   Property.call(this, _config, _owner);

   this.modelStates = util.copy(_config.modelStates, true);

   for (var i = 0; i < this.modelStates.length; ++i) {

      if (this.modelStates[i].hasOwnProperty("source") && !this.modelStates[i].source.hasOwnProperty("property")) {
         this.modelStates[i].source.uName = _config.sources[0].uName;
         this.modelStates[i].source.property = _config.sources[0].property;
      }

      if (this.modelStates[i].hasOwnProperty("action") && !this.modelStates[i].action.hasOwnProperty("property")) {
         this.modelStates[i].action.property = this.name;
      }
   }

   this.createProperty({ name: _config.name + "-model", type: "stateproperty", initialValue: _config.modelInitialState, ignoreControl: true, states: this.modelStates }, _config);
}

util.inherits(ModelProperty, Property);

// Called when system state is required
ModelProperty.prototype.export = function(_exportObj) {
   Property.prototype.export.call(this, _exportObj);
};

// Called to restore system state before hot start
ModelProperty.prototype.import = function(_importObj) {
   Property.prototype.import.call(this, _importObj);
};

// Called after system state has been restored
ModelProperty.prototype.hotStart = function() {
   Property.prototype.hotStart.call(this);
};

// Called to start a cold system
ModelProperty.prototype.coldStart = function () {
   Property.prototype.coldStart.call(this);
};

ModelProperty.prototype.newEventReceivedFromSource = function(_sourceListener, _data) {
};

module.exports = exports = ModelProperty;
