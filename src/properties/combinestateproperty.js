var util = require('util');
var Property = require('../property');
var StateProperty = require('../stateproperty');

function CombineStateProperty(_config, _owner) {
   StateProperty.call(this, _config, _owner);

   this.separator = _config.hasOwnProperty("separator") ? _config.separator : ":";
   this.allSourcesRequiredForValidity = true;

   this.sources = (_config.hasOwnProperty("sources")) ? _config.sources : [];
}

util.inherits(CombineStateProperty, StateProperty);

CombineStateProperty.prototype.coldStart = function(_data) {

   if (!this.initialValueSet) {
      let newState = "";
      let completed = true;

      for (let i = 0; i < this.sources.length; ++i) {
         let sn = (this.sources[i].hasOwnProperty("uName")) ? this.sources[i].uName : this.owner.uName;
         let sl = this.sourceListeners[sn + ":" + this.sources[i].property];

         if (!sl) {
            completed = false;
            break;
         }

         if (sl.isCold()) {
            console.log(this.uName + ": Not ready as one or more sources is still cold");
            completed = false;
            break;
         }

         newState = newState + "" + sl.getPropertyValue();

         if (i < this.sources.length - 1) {
            newState = newState + this.separator;
         }
      }

      if (completed) {
         this.initialValueSet = true;
         this.value = newState;
      }
   }

   Property.prototype.coldStart.call(this, _data);
};

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
      let sn = (this.sources[i].hasOwnProperty("uName")) ? this.sources[i].uName : this.owner.uName;
      let sl = this.sourceListeners[sn + ":" + this.sources[i].property];

      if (!sl) {
         console.info(this.uName + ": Event rejected as it came from source " + sourceName + " which is outside of sources specified");
         return;
      }

      if (sl.isCold()) {
         console.log(this.uName + ": Not ready as one or more sources is still cold. SourceEventName="+sl.sourceEventName);
         return;
      }

      newState = newState + "" + sl.getPropertyValue();
      sourceFound = sourceFound || (this.sources[i].uName === sourceName);

      if (i < this.sources.length - 1) {
         newState = newState + this.separator;
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
