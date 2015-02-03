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
            gpio.on("change", function (value) {
               console.log(that.name + ': Value changed on GPIO Pin ' + that.gpioPin + ' to ' + value);
               value = that.triggerLow ? (value == 1 ? 0 : 1) : value;
               if (value == 1) {
                  that.emit('activated', that.name);
               }
               else {
                  that.emit('deactivated', that.name);
               }
            });

            that.activator.on('activate', function () {
               console.log(that.name + ': received activate event');

               if (!that.actionActive) {
                  gpio.set(that.triggerLow ? 0 : 1, function() {
                     // TODO: What happens here if there is an error?
                     that.actionActive = true;
                  });
               }
            });

            that.activator.on('deactivate', function () {
               console.log(that.name + ': received deactivate event');

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

