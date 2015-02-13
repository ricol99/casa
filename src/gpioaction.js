var util = require('util');
var Gpio = require('gpio');
var Action = require('./action');

function GpioAction(_name, _gpioPin, _triggerLow, _activator, _thing) {
   this.gpioPin = _gpioPin;
   this.triggerLow = _triggerLow;
   this.actionActive = false;

   var that = this;

   Action.call(this, 'gpio:' + _name, _activator, _thing);

   // Calling export with a pin number will export that header and return a gpio header instance
   var gpio = Gpio.export(this.gpioPin, {
      direction: 'out',
      ready: function() {
         gpio.set(that.triggerLow ? 1 : 0, function () {
            // TODO: What happens here if there is an error?

            that.on('activated', function () {
               console.log(that.name + ': received activated event');

               if (!that.actionActive) {
                  that.actionActive = true;
                  gpio.set(that.triggerLow ? 0 : 1, function() {
                     // TODO: What happens here if there is an error?
                  });
               }
            });

            that.on('deactivated', function () {
               console.log(that.name + ': received deactivated event');

               if (that.actionActive) {
                  gpio.set(that.triggerLow ? 1 : 0, function() {
                     // TODO: What happens here if there is an error?
                     that.actionActive = false;
                  });
               }
            });
         });
      }
   });
}

util.inherits(GpioAction, Action);

module.exports = exports = GpioAction;

