var util = require('util');
var Gpio = require('gpio');
var State = require('./state');

function GpioState(_name, _gpioPin, _triggerLow) {
   this.gpioPin = _gpioPin;
   this.triggerLow = _triggerLow;

   State.call(this);
   this.name = 'gpiostate:' + _name;

   var that = this;
 
   // Calling export with a pin number will export that header and return a gpio header instance
   var gpio = Gpio.export(this.gpioPin, {
      direction: 'in',
      interval: 400,
      ready: function() {
         gpio.on("change", function (value) {
            console.log(that.name + ': Value changed on GPIO Pin ' + that.gpioPin + ' to ' + value);
            value = that.triggerLow ? (value == 1 ? 0 : 1) : value;
            if (value == 1) {
               that.emit('active', that.name);
            }
            else {
               that.emit('inactive', that.name);
            }
         });
      }
   });
}

util.inherits(GpioState, State);

module.exports = exports = GpioState;
 
