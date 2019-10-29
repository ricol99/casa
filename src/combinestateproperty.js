var util = require('util');
var StateProperty = require('./stateproperty');

function CombineStateProperty(_config, _owner) {
   StateProperty.call(this, _config, _owner);

   this.sources = (_config.hasOwnProperty("sources")) ? _config.sources : [];
}

util.inherits(CombineStateProperty, StateProperty);

CombineStateProperty.prototype.newEventReceivedFromSource = function(_sourceListener, _data) {
   console.log(this.uName + ": Event received when in state " + this.value);
   let sourceListener = this.sourceListeners[_sourceListener.sourceEventName];

   if (!sourceListener) {
      console.log(this.uName + ": Event received from sourcelistener that is not recognised! " + _sourceListener.sourceEventName);
      return;
   }

   let sourceName = sourceListener.getSourceName();
   let newState = "";
   let sourceFound = false;

   for (let i = 0; i < this.sources.length; ++i) {
      let sl = this.sourceListeners[this.sources[i].uName + ":" + _data.name];

      if (!sl) {
         console.info(this.uName + ": Event rejected as it came from source " + sourceName + " which is outside of sources specified");
         return;
      }

      newState = newState + sl.getPropertyValue().toString();
      sourceFound = sourceFound || (this.sources[i].uName === sourceName);

      if (i < this.sources.length - 1) {
         newState = newState + "-";
      }
   }

   if (!sourceFound) {
      console.info(this.uName + ": Event rejected as it came from source " + sourceName + " which is outside of sources specified");
      return
   }

   console.log(this.uName + ": Attempting to move to state " + newState);
   this.set(newState, { sourceName: this.owner.uName });
};

module.exports = exports = CombineStateProperty;
