var util = require('util');
var Thing = require('../thing');

function TouchSwitch(_config, _parent) {
   Thing.call(this, _config, _parent);
   this.thingType = "touch-switch";

   this.gpioTouchPin = _config.gpioTouchPin;
   this.triggerLow = _config.hasOwnProperty("triggerLow") ? _config.triggerLow : false;
   this.gpioFeedbackPin = _config.hasOwnProperty("gpioFeedbackPin") ? _config.gpioFeedbackPin : null;
   this.feedbackProp = _config.hasOwnProperty("feedbackProp") ? _config.feedbackProp : "ACTIVE";
   this.stateless = _config.hasOwnProperty("stateless") ? _config.stateless : false;

   this.eventName = _config.hasOwnProperty("eventName") ? _config.eventName : "touch-event";
   this.invokeManualMode =  _config.hasOwnProperty("invokeManualMode") ? _config.invokeManualMode : !this.stateless;
   this.displayName = _config.displayName;

   if (this.gpioFeedbackPin) {
      this.ensurePropertyExists(this.feedbackProp, 'gpioproperty', { initialValue: false, gpioPin: this.gpioFeedbackPin, direction: "out" }, _config);
   }
   else {
      this.ensurePropertyExists(this.feedbackProp, 'property', { initialValue: false }, _config);
   }

   this.switchProp = _config.hasOwnProperty("switchProp") ? _config.switchProp : "switch-active";

   this.ensurePropertyExists(this.switchProp, 'gpioproperty', { initialValue: false, gpioPin: this.gpioTouchPin, triggerLow: this.triggerLow }, _config);

   this.holdStartEventName =  _config.hasOwnProperty("holdStartEventName") ? _config.holdStartEventName : "touch-hold-start-event";
   this.holdConfirmEventName =  _config.hasOwnProperty("holdConfirmEventName") ? _config.holdConfirmEventName : "touch-hold-confirm-event";
   this.holdStartTimerDuration = (_config.hasOwnProperty("holdStartTimerDuration")) ? _config.holdStartTimerDuration : 1;
   this.holdTimerDuration = (_config.hasOwnProperty("holdTimerDuration")) ? _config.holdTimerDuration : 2;

   this.ensurePropertyExists("hold-switch-event", "property", { initialValue: _config.hasOwnProperty("holdSwitchEvent") ? _config.holdSwitchEvent : false }, _config);

   this.ensurePropertyExists("switch-state", "stateproperty", { initialValue: "idle", type: "stateproperty", ignoreControl: true, takeControlOnTransition: true,
                                                                states: [{ name: "idle",
                                                                           sources: [{ property: "hold-switch-event", value: true, nextState: "idle-hold-switch-event" },
                                                                                     { property: this.switchProp, value: true, nextState: "user-touching" } ]},
                                                                         { name: "idle-hold-switch-event",
                                                                           sources: [{ property: this.switchProp, value: true, nextState: "user-touching-hold-switch-event" },
                                                                                     { property: "hold-switch-event", value: false, nextState: "idle" }]},
                                                                         { name: "user-touching", actions: [{ event: this.eventName }],
                                                                           timeout: { duration: this.holdStartTimerDuration, nextState: "user-holding" },
                                                                           sources: [{ property: this.switchProp, value: false, nextState: "idle"}]},
                                                                         { name: "user-touching-hold-switch-event",
                                                                           timeout: { duration: this.holdStartTimerDuration, nextState: "user-holding-hold-switch-event" },
                                                                           sources: [{ property: this.switchProp, value: false, nextState: "send-delayed-touch-event"}]},
                                                                         { name: "send-delayed-touch-event", actions: [{ event: this.eventName }],
                                                                           timeout: { duration: 0.1, nextState: "idle" }},
                                                                         { name: "user-holding", actions: [{ event: this.holdStartEventName }],
                                                                           timeout: { duration: this.holdTimerDuration, nextState: "user-hold-confirmed" },
                                                                           sources: [{ property: this.switchProp, value: false, nextState: "idle"}]},
                                                                         { name: "user-holding-hold-switch-event", actions: [{ event: this.holdStartEventName }],
                                                                           timeout: { duration: this.holdTimerDuration, nextState: "user-hold-confirmed" },
                                                                           sources: [{ property: this.switchProp, value: false, nextState: "send-delayed-touch-event"}]},
                                                                         { name: "user-hold-confirmed", actions: [{ event: this.holdConfirmEventName }],
                                                                           sources: [{ property: this.switchProp, value: false, nextState: "idle"}]} ]}, _config);
}

util.inherits(TouchSwitch, Thing);

// Called when current state required
TouchSwitch.prototype.export = function(_exportObj) {
   Thing.prototype.export.call(this, _exportObj);
};

// Called when current state required
TouchSwitch.prototype.import = function(_importObj) {
   Thing.prototype.import.call(this, _importObj);
};

TouchSwitch.prototype.coldStart = function() { 
   Thing.prototype.coldStart.call(this);
};

TouchSwitch.prototype.hotStart = function() {
   Thing.prototype.hotStart.call(this);
};

TouchSwitch.prototype.propertyAboutToChange = function(_propName, _propValue, _data) {

   if (!_data.coldStart && (_propName === this.switchProp) && _propValue && this.invokeManualMode) {
      this.setManualMode();
   }
};

module.exports = exports = TouchSwitch;
