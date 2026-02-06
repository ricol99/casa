var util = require('util');
var Thing = require('../thing');

function TouchSwitch(_config, _parent) {
   Thing.call(this, _config, _parent);
   this.thingType = "touch-switch";

   this.gpioIncluded = _config.hasOwnProperty("gpioTouchPin");

   if (this.gpioIncluded) {
      this.gpioTouchPin = _config.gpioTouchPin;
      this.triggerLow = _config.hasOwnProperty("triggerLow") ? _config.triggerLow : false;
      this.gpioFeedbackPin = _config.hasOwnProperty("gpioFeedbackPin") ? _config.gpioFeedbackPin : null;
      this.debounceThreshold = _config.hasOwnProperty("debounceThreshold") ? _config.debounceThreshold : 0.2;
   }

   this.feedbackProp = _config.hasOwnProperty("feedbackProp") ? _config.feedbackProp : "ACTIVE";
   this.stateless = _config.hasOwnProperty("stateless") ? _config.stateless : false;

   this.eventName = _config.hasOwnProperty("eventName") ? _config.eventName : "touch-event";
   this.invokeManualMode =  _config.hasOwnProperty("invokeManualMode") ? _config.invokeManualMode : !this.stateless;
   this.displayName = _config.displayName;
   this.doubleTapEventName = _config.hasOwnProperty("doubleTapEventName") ? _config.doubleTapEventName : null;
   this.doubleTapWindow = _config.hasOwnProperty("doubleTapWindow") ? _config.doubleTapWindow : 0;
   this.pendingSingleTapTimer = null;

   if (this.gpioIncluded && this.gpioFeedbackPin) {
      this.ensurePropertyExists(this.feedbackProp, 'gpioproperty', { initialValue: false, gpioPin: this.gpioFeedbackPin, direction: "out" }, _config);
   }
   else {
      this.ensurePropertyExists(this.feedbackProp, 'property', { initialValue: false }, _config);
   }

   this.switchProp = _config.hasOwnProperty("switchProp") ? _config.switchProp : "switch-active";

   if (this.gpioIncluded) {
      this.switchPropRaw = this.switchProp + "-raw";
      this.ensurePropertyExists(this.switchPropRaw, 'gpioproperty', { initialValue: false, gpioPin: this.gpioTouchPin, triggerLow: this.triggerLow }, _config);
      this.ensurePropertyExists(this.switchProp, 'debounceproperty', { threshold: this.debounceThreshold, ignoreUnderThreshold: true, source: { property: this.switchPropRaw }}, _config);
   }

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

TouchSwitch.prototype.raiseEvent = function(_eventName, _data) {

   if (this.doubleTapEventName && (this.doubleTapWindow > 0) && (_eventName === this.eventName)) {

      if (this.pendingSingleTapTimer) {
         util.clearTimeout(this.pendingSingleTapTimer);
         this.pendingSingleTapTimer = null;
         return Thing.prototype.raiseEvent.call(this, this.doubleTapEventName, _data);
      }

      this.pendingSingleTapTimer = util.setTimeout(() => {
         this.pendingSingleTapTimer = null;
         Thing.prototype.raiseEvent.call(this, this.eventName, _data);
      }, this.doubleTapWindow * 1000);

      return true;
   }

   return Thing.prototype.raiseEvent.call(this, _eventName, _data);
};

module.exports = exports = TouchSwitch;
