
var util = require('util');
var Gpio = require('gpio');
var events = require('events');

function GpioAction(_name, _gpioPin, _triggerLow, _activator) {
   var name = 'gpioaction:' + _name;
   var gpioPin = _gpioPin;
   var triggerLow = _triggerLow;

   var actionActive = false;
   var activator = _activator;
   var that = this;

   events.EventEmitter.call(this);

   // Calling export with a pin number will export that header and return a gpio header instance
   var gpio = Gpio.export(gpioPin, {
      // When you export a pin, the default direction is out. This allows you to set
      // the pin value to either LOW or HIGH (3.3V) from your program.
      direction: 'out',

      // Due to the asynchronous nature of exporting a header, you may not be able to
      // read or write to the header right away. Place your logic in this ready
      // function to guarantee everything will get fired properly
      ready: function() {
         gpio.set(triggerLow ? 1 : 0, function () {
            gpio.on("change", function (value) {
               console.log('Value changed on GPIO Pin ' + gpioPin + ' to ' + value);
               value = triggerLow ? (value == 1 ? 0 : 1) : value;
               if (value == 1) {
                  that.emit('activated', that.name);
               }
               else {
                  that.emit('deactivated', that.name);
               }
            });

            activator.on('activate', function () {
               console.log(name + ': received activate event');

               if (!actionActive) {
                  gpio.set(triggerLow ? 0 : 1, function() {
                     // TODO: What happens here if there is an error?
                     actionActive = true;
                  });
               }
            });

            activator.on('deactivate', function () {
               console.log(name + ': received deactivate event');

               if (actionActive) {
                  gpio.set(triggerLow ? 1 : 0, function() {
                     // TODO: What happens here if there is an error?
                     actionActive = false;
                  });
               }
            });
         });
      }
   });
}

util.inherits(GpioAction, events.EventEmitter);

var create = function(_name, _gpioPin, _triggerLow, _activator) {
   return new GpioAction(_name, _gpioPin, _triggerLow, _activator);
}

exports.create = create;
exports.GpioAction = GpioAction;

