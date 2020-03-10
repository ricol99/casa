var util = require('util');
var Property = require('../property');
var StateProperty = require('../stateproperty');

function CombineStateProperty(_config, _owner) {

   if (!_config.hasOwnProperty('states') || (_config.states.length === 0)) {
      _config.states = [ { name: "DEFAULT",  priority: -9999 } ];
   }
   else {
      let defFound = false;

      for (let i = 0; i < _config.states.length; ++i) {
         defFound = defFound || (_config.states[i].name === "DEFAULT");
      }

      if (!defFound) {
         _config.states.push({ name: "DEFAULT", priority: -9999 });
      }
   }

   StateProperty.call(this, _config, _owner);
   this.separator = _config.hasOwnProperty("separator") ? _config.separator : ":";
   this.allSourcesRequiredForValidity = true;

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
      let sn = (this.sources[i].hasOwnProperty("fullName")) ? this.sources[i].fullName : this.fullName;
      let sl = this.sourceListeners[sn + ":" + this.sources[i].property];

      if (!sl) {
         console.info(this.uName + ": Event rejected as it came from source " + sourceName + " which is outside of sources specified");
         return;
      }

      if (sl.isCold()) {
         console.log(this.uName + ": Not ready as one or more sources is still cold");
         return;
      }

      newState = newState + "" + sl.getPropertyValue();
      sourceFound = sourceFound || (this.sources[i].fullName === sourceName);

      if (i < this.sources.length - 1) {
         newState = newState + this.separator;
      }
   }

   if (!sourceFound) {
      console.info(this.uName + ": Event rejected as it came from source " + sourceName + " which is outside of sources specified");
      return
   }

   console.log(this.uName + ": Attempting to move to state " + newState);
   this.set(newState, { sourceName: this.owner.fullName });
};

module.exports = exports = CombineStateProperty;
