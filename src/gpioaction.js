var util = require('util');
var Gpio = require('gpio');
var Action = require('./action');
var CasaSystem = require('./casasystem');

function GpioAction(_name, _gpioPin, _triggerLow, _activator, _thing) {

   this.gpioPin = 0;
   this.triggerLow = false;

   if (_name.name) {
      // constructing from object rather than params
      this.gpioPin = _name.gpioPin;
      this.triggerLow = _name.triggerLow;

      // Resolve source and **TBD** target
      var casaSys = CasaSystem.mainInstance();
      var source = casaSys.findSource(_name.source);

      Action.call(this, _name.name, source, null);
   }
   else {
      this.gpioPin = _gpioPin;
      this.triggerLow = _triggerLow;
      Action.call(this, _name, _activator, _thing);
   }

   this.actionActive = false;
   var that = this;

   // Calling export with a pin number will export that header and return a gpio header instance
   var gpio = Gpio.export(this.gpioPin, {
      direction: 'out',
      ready: function() {
         gpio.set(that.triggerLow ? 1 : 0, function () {
            // **TBD** What happens here if there is an error?

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

