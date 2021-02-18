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

   if (_config.hasOwnProperty("holdEventName")) {
      this.holdEventName = _config.holdEventName;
      this.holdTimerDuration = (_config.hasOwnProperty("holdTimerDuration")) ? _config.holdTimerDuration : 3;
      this.holding = false;
   }

   if (this.gpioFeedbackPin) {
      this.ensurePropertyExists(this.feedbackProp, 'gpioproperty', { initialValue: false, gpioPin: this.gpioFeedbackPin, direction: "out" }, _config);
   }
   else {
      this.ensurePropertyExists(this.feedbackProp, 'property', { initialValue: false }, _config);
   }

   this.switchProp = _config.hasOwnProperty("switchProp") ? _config.switchProp : "switch-state";

   this.ensurePropertyExists(this.switchProp, 'gpioproperty', { initialValue: false, gpioPin: this.gpioTouchPin, triggerLow: this.triggerLow }, _config);
}

util.inherits(TouchSwitch, Thing);

TouchSwitch.prototype.propertyAboutToChange = function(_propName, _propValue, _data) {

   if (!_data.coldStart) {

      if (_propName === this.switchProp) {

         if (this.stateless) {

            if (_propValue) {

               if (this.holdEventName) {

                  this.holdTimer = setTimeout( () => {
                     this.holdTimer = null;
                     this.raiseEvent(this.holdEventName);
                     this.raiseEvent(this.holdEventName+"-start");
                     this.holding = true;
                  }, this.holdTimerDuration * 1000);
               }
               else {
                  this.raiseEvent(this.eventName);
               }
            }
            else if (this.holdEventName) {

               if (this.holdTimer) {
                  clearTimeout(this.holdTimer);
                  this.holdTimer = null;
                  this.raiseEvent(this.eventName);
               }
               else if (this.holding) {
                  this.holding = false;
                  this.raiseEvent(this.holdEventName+"-end");
               }
            }
         }
         else if (this.invokeManualMode) {
            this.setManualMode();
         }
      }
   }
};

module.exports = exports = TouchSwitch;
