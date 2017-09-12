var util = require('util');
var Thing = require('../thing');
var CasaSystem = require('../casasystem');

function TouchSwitch(_config) {
   this.casaSys = CasaSystem.mainInstance();

   Thing.call(this, _config);
   this.thingType = "touch-switch";

   this.gpioTouchPin = _config.gpioTouchPin;
   this.triggerLow = _config.hasOwnProperty("triggerLow") ? _config.triggerLow : true,

   this.gpioFeedbackPin = _config.hasOwnProperty("gpioFeedbackPin") ? _config.gpioFeedbackPin : undefined,
   this.feedbackProp = _config.hasOwnProperty("feedbackProp") ? _config.feedbackProp : "ACTIVE";
   this.stateless = _config.hasOwnProperty("stateless") ? _config.stateless : false;

   this.eventName = _config.hasOwnProperty("eventName") ? _config.eventName : "touch-event";
   this.invokeManualMode =  _config.hasOwnProperty("invokeManualMode") ? _config.invokeManualMode : !this.stateless;
   this.displayName = _config.displayName;

   this.ensurePropertyExists('touch', 'gpioproperty', { initialValue: false, gpioPin: this.gpioTouchPin, triggerLow: this.triggerLow,
                                                        "sourceSteps": [ { "type": "latchstep", "minOutputTime": 2 } ] }, _config);

   if (this.gpioFeedbackPin) {
      this.ensurePropertyExists(this.feedbackProp, 'gpioproperty', { initialValue: false, gpioPin: this.gpioFeedbackPin, direction: "out" }, _config);
   }
   else {
      this.ensurePropertyExists(this.feedbackProp, 'property', { initialValue: false }, _config);
   }

   if (!this.stateless) {
      this.switchProp = _config.hasOwnProperty("switchProp") ? _config.switchProp : "ACTIVE";

      if (this.switchProp !== this.feedbackProp) {
         this.ensurePropertyExists(this.switchProp, 'property', { initialValue: false }, _config);
      }
   }
}

util.inherits(TouchSwitch, Thing);

TouchSwitch.prototype.propertyAboutToChange = function(_propName, _propValue, _data) {

   if (!_data.coldStart) {

      if (_propName == "touch") {
          this.raiseEvent(this.eventName, { value: _propValue });

          if (this.invokeManualMode) {
             this.setManualMode();
          }

          if (!this.stateless) {
             this.updateProperty(this.switchProp, !(this.getProperty(this.switchProp)));
          }
      }
   }
};

module.exports = exports = TouchSwitch;
