var util = require('../util');
var ModelProperty = require('./modelproperty');

function DebounceProperty(_config, _owner) {
   this.threshold = _config.threshold;
   this.ignoreUnderThreshold = _config.hasOwnProperty("ignoreUnderThreshold") ? _config.ignoreUnderThreshold : false;
   _config.modelInitialState = "not-set";


   if (this.ignoreUnderThreshold) {
      _config.modelStates = [ { name: "not-set", source: { value: true, nextState: "not-set-holding" }, action: { value: false }},
                              { name: "not-set-holding", source: { value: false, nextState: "not-set" }, timeout: { "duration": _config.threshold, nextState: "set" }},
                              { name: "set", source: { value: false, nextState: "set-holding" }, action: { value: true }},
                              { name: "set-holding", source: { value: true, nextState: "set" }, timeout: { "duration": _config.threshold, nextState: "not-set" }} ];
   }
   else {
      _config.modelStates = [ { name: "not-set", source: { value: true, nextState: "set-holding" }},
                              { name: "set-holding", action: { value: true }, timeout: { "duration": _config.threshold, nextState: "set" }},
                              { name: "set", source: { value: false, nextState: "not-set-holding" }},
                              { name: "not-set-holding", action: { value: false}, timeout: { "duration": _config.threshold, nextState: "not-set" }} ];
   }

   ModelProperty.call(this, _config, _owner);
}

util.inherits(DebounceProperty, ModelProperty);

module.exports = exports = DebounceProperty;
