var util = require('util');
var Thing = require('../thing');

function TouchSwitch(_config) {
   Thing.call(this, _config);
   this.thingType = "touch-switch";

   this.gpioTouchPin = _config.gpioTouchPin;
   this.triggerLow = _config.hasOwnProperty("triggerLow") ? _config.triggerLow : true,

   this.gpioFeedbackPin = _config.hasOwnProperty("gpioFeedbackPin") ? _config.gpioFeedbackPin : null,
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

   this.gpioService =  this.gang.findService("service:gpio");

   if (!this.gpioService) {
      console.error(this.uName + ": ***** GpioService service not found! *************");
      process.exit(1);
   }

   if (this.gpioFeedbackPin) {
      this.ensurePropertyExists(this.feedbackProp, 'gpioproperty', { initialValue: false, gpioPin: this.gpioFeedbackPin, direction: "out" }, _config);
   }
   else {
      this.ensurePropertyExists(this.feedbackProp, 'property', { initialValue: false }, _config);
   }

   if (!this.stateless) {
      this.switchProp = _config.hasOwnProperty("switchProp") ? _config.switchProp : "ACTIVE";

      this.ensurePropertyExists(this.switchProp, 'gpioproperty', { initialValue: false, gpioPin: this.gpioTouchPin, triggerLow: this.triggerLow,
                                                                   sourceSteps: [ { type: "latchstep", minOutputTime: 2 } ] }, _config);
   }
   else {
      this.gpioService.createPin(this, this.gpioTouchPin, "in", this.triggerLow);
   }
}

util.inherits(TouchSwitch, Thing);

TouchSwitch.prototype.gpioPinStatusChanged = function(_pin, _value) {

   if (_value) {

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
};

TouchSwitch.prototype.propertyAboutToChange = function(_propName, _propValue, _data) {

   if (!_data.coldStart) {

      if (_propName === this.switchProp) {

         if (this.invokeManualMode) {
            this.setManualMode();
         }
      }
   }
};

module.exports = exports = TouchSwitch;
