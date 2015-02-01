var util = require('util');
var Gpio = require('gpio');
var events = require('events');

function GpioState(_name, _gpioPin, _triggerLow) {
   var name = 'gpiostate:' + _name;
   var gpioPin = _gpioPin;
   var triggerLow = _triggerLow;

   events.EventEmitter.call(this);
   var that = this;
 
   // Calling export with a pin number will export that header and return a gpio header instance
   var gpio = Gpio.export(gpioPin, {
      // When you export a pin, the default direction is out. This allows you to set
      // the pin value to either LOW or HIGH (3.3V) from your program.
      direction: 'in',

      // set the time interval (ms) between each read when watching for value changes
      // note: this is default to 100, setting value too low will cause high CPU usage
      interval: 400,

      // Due to the asynchronous nature of exporting a header, you may not be able to
      // read or write to the header right away. Place your logic in this ready
      // function to guarantee everything will get fired properly
      ready: function() {
         gpio.on("change", function (value) {
            console.log('Value changed on GPIO Pin ' + gpioPin + ' to ' + value);
            value = triggerLow ? (value == 1 ? 0 : 1) : value;
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

util.inherits(GpioState, events.EventEmitter);

var create = function(_name, _gpioPin, _triggerLow) {
   return new GpioState(_name, _gpioPin, _triggerLow);
}

exports.create = create;
exports.GpioState = GpioState; 
 
