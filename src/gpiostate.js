var util = require('util');
var Gpio = require('gpio');
var State = require('./state');

function GpioState(_name, _gpioPin, _triggerLow, _thing) {

   if (_name.name) {
      // constructing from object rather than params
      this.gpioPin = _name.gpioPin;
      this.triggerLow = _name.triggerLow;
      State.call(this, _name.name, _name.owner);
   }
   else {
      this.gpioPin = _gpioPin;
      this.triggerLow = _triggerLow;
      State.call(this, _name, _thing);
   }

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
 
