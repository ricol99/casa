var util = require('util');
var Property = require('../property');

function QuantiseProperty(_config, _owner) {
   Property.call(this, _config, _owner);
   this.quanta = _config.quanta;
   this.boundaries = [];
   this.boundariesMap = {};
   this.bufferTimers = _config.hasOwnProperty("bufferTimers") ? _config.buffersTimers : {};
   this.bufferName = null;

   for (var q in this.quanta) {
      var bufferTimer = this.bufferTimers.hasOwnProperty(q) ? this.bufferTimers[q] : 0;
      this.boundaries.push({ name: q, value: this.quanta[q] });
      this.boundariesMap[q] = { value: this.quanta[q], bufferTimer: bufferTimer };
   }

   this.boundaries.sort((_a, _b) => {
      return _a.value - _b.value;
   });
}

util.inherits(QuantiseProperty, Property);

// Called when system state is required
QuantiseProperty.prototype.export = function(_exportObj) {
   Property.prototype.export.call(this, _exportObj);
};

// Called to restore system state before hot start
QuantiseProperty.prototype.import = function(_importObj) {
   Property.prototype.import.call(this, _importObj);
};

// Called after system state has been restored
QuantiseProperty.prototype.hotStart = function() {
   Property.prototype.hotStart.call(this);
};

// Called to start a cold system
QuantiseProperty.prototype.coldStart = function () {
   Property.prototype.coldStart.call(this);
};

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

   if (this.value != name) {

      if (!this.bufferTimer) {
         this.setWithBuffer(name, _data);
      }
      else if (this.bufferName !== name) {
         util.clearTimeout(this.bufferTimer);
         this.bufferTimer = null;
         this.bufferName = null;
         this.setWithBuffer(name, _data);
      }
   }
   else if (this.bufferTimer) {
      util.clearTimeout(this.bufferTimer);
      this.bufferTimer = null;
      this.bufferName = null;
   }
}

QuantiseProperty.prototype.setWithBuffer = function(_name, _data) {

   if (this.boundariesMap[_name].bufferTimer > 0) {
      this.bufferName = _name;
         
      this.bufferTimer = util.setTimeout( () => {
         this.bufferTimer = null;
         this.bufferName = null;
         this.updatePropertyInternal(_name, _data);
      }, this.boundariesMap[_name].bufferTimer * 1000);
   }
   else {
      this.updatePropertyInternal(_name, _data);
   }
};

module.exports = exports = QuantiseProperty;
