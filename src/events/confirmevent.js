var util = require('util');
var Event = require('../event');

function ConfirmEvent(_config, _owner) {
   Event.call(this, _config, _owner);

   this.confirmationInputs = _config.confirmationInputs;
   this.confirmationTimeout = _config.confirmationTimeout;

   this.buffer = {};
   this.bufferLength = 0;
}

util.inherits(ConfirmEvent, Event);

// Called when system state is required
ConfirmEvent.prototype.export = function(_exportObj) {
   Event.prototype.export.call(this, _exportObj);
};

// Called when system state is required
ConfirmEvent.prototype.import = function(_importObj) {
   Event.prototype.import.call(this, _importObj);
};

// Derived Events should override this for start-up code
ConfirmEvent.prototype.coldStart = function() {
   Event.prototype.coldStart.call(this);
};

// Derived Events should override this for hot start-up code
ConfirmEvent.prototype.hotStart = function() {
   Event.prototype.hotStart.call(this);
};

ConfirmEvent.prototype.newEventReceivedFromSource = function(_sourceListener, _data) {

   if (this.bufferedSources.hasOwnProperty(_sourceListener.uName)) {
      this.bufferedSources[_sourceListener.uName].reset();
   }
   else {
      this.buffer[_sourceListener.uName] = new ConfEvent(this, _sourceListener, _data);
      this.bufferLength++;
   }

   if (this.shouldRaiseEvent()) {
      this.raiseEvent(_data);
   }
};

ConfirmEvent.prototype.shouldRaiseEvent = function() {
   return this.bufferLength >= this.confirmationInputs;
};

ConfirmEvent.prototype.popConfEvent = function(_confEvent) {
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

module.exports = exports = ConfirmEvent;
 
