var util = require('util');
var Property = require('../property');

function StateProperty(_config, _owner) {
   Property.call(this, _config, _owner);

   this.sourceListeners = {};
   this.states = {};

   for (var stateName in _config.states) {

      if (_config.states.hasOwnProperty(stateName)) {
         this.states[stateName] = new State(_config.states[stateName], this);
      }
   }

   this.setState(this.value);
}

util.inherits(StateProperty, Thing);

StateProperty.prototype.propertyAboutToChange = function(_propertyName, _propertyValue, _data) {
   var currentState = this.states[this.value];
   var source = null;

   if (!sourceListener[_data.sourceEventName]) {
      return;
   }

   if (currentState && currentState.sourceMap[_data.sourceEventName]) {
      source = (currentState.sourceMap[_data.sourceEventName][_propertyValue]) ?
                  currentState.sourceMap[_data.sourceEventName][_propertyValue] :
                  currentState.sourceMap[_data.sourceEventName]["DEFAULT_VALUE"];
   }

   if (!source && this.states["DEFAULT"] && this.states["DEFAULT"].sourceMap[_data.sourceEventName]) {
      source = (this.states["DEFAULT"].sourceMap[_data.sourceEventName][_propertyValue]) ?
                  this.states["DEFAULT"].sourceMap[_data.sourceEventName][_propertyValue] :
                  this.states["DEFAULT"].sourceMap[_data.sourceEventName]["DEFAULT_VALUE"];
   }

   if (source) {
      this.alignTargetProperties(source);

      if (source.hasOwnProperty("nextState")) {
         this.setState(source.nextState);
      }
   }
};

StateProperty.prototype.setState = function(_nextState) {

   if (this.stateTimer) {
      clearTimeout(this.stateTimer);
      this.stateTimer = null;
   }

   if (this.states[source.nextState] && (this.states[source.nextState].hasOwnProperty("timeout")) {

      this.stateTimer = setTimeout(function(_this, _nextState) {
         _this.stateTimer = null;
         _this.setState(_nextState);
      }), this.this.states[source.nextState].timeout * 1000, this, source.nextState);
   }

   this.updatePropertyInternal(source.nextState);
};

StateProperty.prototype.findAction = function(_source, _propertyValue) {
   var ret = _source;

   if (_source.hasOwnProperty("value") && (_source.value != _propertyValue)) {
      ret = null;
   }

   return ret;
};

StateProperty.prototype.alignTargetProperties = function(_source) {
   var targets = _source.hasOwnProperty("targets") ? _source.targets : (_source.hasOwnProperty("target") ? [ _source.target ] : null);

   if (targets) {

      for (var i = 0; i < targets.length; ++i) {
          this.owner.updateProperty(targets[i].property, targets[i].value);
      }
   }
};

StateProperty.prototype.sourceIsValid = function(_data) {
};

StateProperty.prototype.sourceIsInvalid = function(_data) {
};

StateProperty.prototype.fetchOrCreateSourceListener = function(_config) {
   var sourceListenerName = _config.name + ":" + (_config.hasOwnProperty("property")) ? _config.property : _config.event;
   var sourceListener = this.sourceListeners[sourceListenerName];

   if (!sourceListener) {
      this.config.uName = _config.name;
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

   for (var i = 0; i < this.sources.length; i++) {

      if (!this.sources[i].hasOwnProperty("name")) {
         this.sources[i].name = this.owner.owner.uName;
      }

      var this.sources[i].sourceListener = this.owner.fetchOrCreateSourceListener(this.sources[i]);
      var val = this.sources[i].hasOwnProperty("value") ? this.sources[i].value : "DEFAULT_ENTRY";

      if (!this.sourceMap[sourceListener.sourceEventName]) {
         this.sourceMap[sourceListener.sourceEventName] = {};
      }
      this.sourceMap[sourceListener.sourceEventName][val] = this.sources[i];
   }
}

module.exports = exports = StateProperty;
