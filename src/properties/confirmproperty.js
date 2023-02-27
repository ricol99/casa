var util = require('util');
var Property = require('../property');

function ConfirmProperty(_config, _owner) {
   _config.allSourcesRequiredForValidity = false;
   Property.call(this, _config, _owner);
   this.confirmationInputs = _config.confirmationInputs;
   this.confirmationTimeout = _config.confirmationTimeout;

   this.buffer = {};
   this.bufferLength = 0;
}

util.inherits(ConfirmProperty, Property);

// Called when system state is required
ConfirmProperty.prototype.export = function(_exportObj) {
   Property.prototype.export.call(this, _exportObj);
};

// Called to restore system state before hot start
ConfirmProperty.prototype.import = function(_importObj) {
   Property.prototype.import.call(this, _importObj);
};

// Called after system state has been restored
ConfirmProperty.prototype.hotStart = function() {
   Property.prototype.hotStart.call(this);
};

// Called to start a cold system
ConfirmProperty.prototype.coldStart = function () {
   Property.prototype.coldStart.call(this);
};

ConfirmProperty.prototype.newEventReceivedFromSource = function(_sourceListener, _data) {

   if (_data.value) {

      if (this.bufferedSources.hasOwnProperty(_sourceListener.uName)) {
         this.bufferedSources[_sourceListener.uName].reset();
      }
      else {
         this.buffer[_sourceListener.uName] = new ConfEvent(this, _sourceListener, _data);
         this.bufferLength++;
      }
   }

   var newValue = this.calculateOutputValue();
 
   if (newValue !== this.value) {
      this.updatePropertyInternal(newValue, _data);
   }
};

ConfirmProperty.prototype.calculateOutputValue = function() {
   return this.bufferLength >= this.confirmationInputs;
};

ConfirmProperty.prototype.amIValid = function() {

   var ret = Property.prototype.amIValid.call(this);

   if (ret && !this.cold) {
      var newValue = this.calculateOutputValue();
 
      if (newValue !== this.value) {
         this.updatePropertyInternal(newValue, { sourceName: this.owner.uName });
      }
   }

   return ret;
};

ConfirmProperty.prototype.popConfEvent = function(_confEvent) {
   delete this.buffer[_confEvent.sourceListener.uName];
   this.bufferLength--;
};

function ConfEvent(_owner, _sourceListener, _data) {
   this.owner = _owner;
   this.sourceListener = _sourceListener;

   this.timeout = util.setTimeout( () => {
      this.owner.popConfEvent(this);
   }, this.owner.confirmationTimeout*1000);
}

ConfEvent.prototype.reset = function() {
   util.clearTimeout(this.timeout);

   this.timeout = util.setTimeout( () => {
      this.owner.popConfEvent(this);
   }, this.owner.confirmationTimeout*1000);
};

module.exports = exports = ConfirmProperty;
