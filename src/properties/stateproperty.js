var util = require('util');
var Property = require('../property');
var SourceListener = require('../sourcelistener');

function StateProperty(_config, _owner) {
   Property.call(this, _config, _owner);

   this.states = {};

   for (var i = 0; i < _config.states.length; ++i) {
      console.log(this.uName+": AAAAAAA creating new state called " + _config.states[i].name);
      this.states[_config.states[i].name] = new State(_config.states[i], this);
   }

   this.setState(this.value);
}

util.inherits(StateProperty, Property);

StateProperty.prototype.propertyAboutToChange = function(_propertyValue, _data) {
   console.log(this.uName + ": state about to change to " + _propertyValue);
   this.setState(_propertyValue);
};

StateProperty.prototype.newEventReceivedFromSource = function(_sourceListener, _data) {
   console.log(this.uName + ": AAAA Event received when in state " + this.value);
   console.log(this.uName + ": AAAA SourceEventName="+_sourceListener.sourceEventName);

   var propertyValue = _data.value;
   var currentState = this.states[this.value];
   var source = null;

   if (!this.sourceListeners[_sourceListener.sourceEventName]) {
      console.log(this.uName + ": Event received from sourcelistener that is not recognised! " + _sourceListener.sourceEventName);
      return;
   }


   if (currentState && currentState.sourceMap[_sourceListener.sourceEventName]) {
   console.log(this.uName+": AAAAAA Current state="+ currentState.name);
   console.log(this.uName+": AAAAAA Current state source map=", currentState.sourceMap[_sourceListener.sourceEventName]);
      source = (currentState.sourceMap[_sourceListener.sourceEventName][propertyValue]) ?
                  currentState.sourceMap[_sourceListener.sourceEventName][propertyValue] :
                  currentState.sourceMap[_sourceListener.sourceEventName]["DEFAULT_VALUE"];
   }

   if (!source && this.states["DEFAULT"] && this.states["DEFAULT"].sourceMap[_data.sourceEventName]) {
      source = (this.states["DEFAULT"].sourceMap[_sourceListener.sourceEventName][propertyValue]) ?
                  this.states["DEFAULT"].sourceMap[_sourceListener.sourceEventName][propertyValue] :
                  this.states["DEFAULT"].sourceMap[_sourceListener.sourceEventName]["DEFAULT_VALUE"];
   }

   if (source) {
      console.log(this.uName + ": AAAA Source found! Source="+source.name);
      console.log(this.uName + ": AAAA Source found! Next state="+source.nextState);

      if (source.hasOwnProperty("nextState")) {
         this.set(source.nextState, { sourceName: this.owner });
      }
   }
};

StateProperty.prototype.setState = function(_nextState) {

   if (this.stateTimer) {
      clearTimeout(this.stateTimer);
      this.stateTimer = null;
   }

   if (this.states[_nextState]) {

      if (this.states[_nextState].hasOwnProperty("timeout")) {

         this.stateTimer = setTimeout(function(_this, _nextState) {
            _this.stateTimer = null;
            _this.set(_nextState, { sourceName: _this.owner });
         }, this.states[_nextState].timeout * 1000, this, _nextState);
      }

      this.alignTargetProperties(this.states[_nextState]);
   }
};

StateProperty.prototype.alignTargetProperties = function(_state) {
   var targets = _state.hasOwnProperty("targets") ? _state.targets : (_state.hasOwnProperty("target") ? [ _state.target ] : null);

   if (targets) {

      for (var i = 0; i < targets.length; ++i) {
          console.log(this.uName+": AAAAA Aligning property "+targets[i].property+" with value "+targets[i].value);
          this.owner.updateProperty(targets[i].property, targets[i].value);
      }
   }
};

StateProperty.prototype.sourceIsValid = function(_data) {
};

StateProperty.prototype.sourceIsInvalid = function(_data) {
};

StateProperty.prototype.fetchOrCreateSourceListener = function(_config) {
   console.log(this.uName+": AAAAAAA attempting to fing sourcelistener for config", _config);
   var sourceListenerName = _config.name + ":" + ((_config.hasOwnProperty("property")) ? _config.property : _config.event);
   console.log(this.uName+": AAAAAAA source listener name="+ sourceListenerName);
   var sourceListener = this.sourceListeners[sourceListenerName];

   if (!sourceListener) {
      console.log(this.uName+": AAAAAAA creating new sourcelistener called " + sourceListenerName);
      _config.uName = _config.name;
      sourceListener = new SourceListener(_config, this);
      this.sourceListeners[sourceListenerName] = sourceListener;
   }

   return sourceListener;
};

function State(_config, _owner) {
   this.name = _config.name;
   this.owner = _owner;
   this.uName = _owner.uName + ":state:" + this.name;
   this.sourceMap = {};

   if (_config.hasOwnProperty("source")) {
      _config.sources = [ _config.source ];
   }

   this.sources = _config.sources;

   if (!this.sources) {
      return;
   }

   for (var i = 0; i < this.sources.length; i++) {

      if (!this.sources[i].hasOwnProperty("name")) {
         this.sources[i].name = this.owner.owner.uName;
      }

      var sourceListener = this.owner.fetchOrCreateSourceListener(this.sources[i]);
      this.sources[i].sourceListener = sourceListener;
      var val = this.sources[i].hasOwnProperty("value") ? this.sources[i].value : "DEFAULT_VALUE";

      if (!this.sourceMap[sourceListener.sourceEventName]) {
         this.sourceMap[sourceListener.sourceEventName] = {};
      }

      console.log(this.uName+": AAAAAA adding to source map sourceEventName="+sourceListener.sourceEventName+" value="+val);
      this.sourceMap[sourceListener.sourceEventName][val] = this.sources[i];
   }
}

module.exports = exports = StateProperty;
