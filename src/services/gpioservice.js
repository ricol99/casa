var util = require('util');
var Gpio = require('onoff').Gpio;
var Service = require('../service');

function GpioService(_config, _owner) {
   Service.call(this, _config, _owner);

   this.gpios = {};

}

util.inherits(GpioService, Service);

GpioService.prototype.createPin = function(_owner, _pin, _direction, _triggerLow) {
   var gpio = new GpioPin(_owner, _pin, _direction, _triggerLow);
   this.gpios[_owner] = { gpio: gpio, owner: _owner };
   gpio.start();
   return gpio;
};

function GpioPin(_owner, _pin, _direction, _triggerLow) {
   this.owner = _owner;
   this.gpioPin = _pin;
   this.direction = _direction;
   this.triggerLow = (_triggerLow == undefined) ? true :_triggerLow;
   this.writable = (this.direction === 'out') || (this.direction === 'inout');

   this.gpio = new Gpio(this.gpioPin, this.direction, 'both');

   process.on('SIGINT', () => {
      if (this.gpio) {
         this.gpio.unexport();
      }
   });
}

GpioPin.prototype.start = function() {

   if ((this.direction === 'in') || (this.direction === 'inout')) {

      this.gpio.read( (_err, _value) => {
         this.value = this.triggerLow ? (_value == 1 ? 0 : 1) : _value;

         this.gpio.watch( (_err, _value) => {

            if (_err) {
               console.error(this.uName + ": Error from gpio library! Error = " + _err);
            }
            else {
               var newValue = this.triggerLow ? (_value == 1 ? 0 : 1) : _value;

               if (newValue != this.value) {
                  console.log(this.uName + ': Value changed on GPIO Pin ' + this.gpioPin + ' to ' + newValue);
                  this.value = newValue;
                  this.owner.gpioPinStatusChanged(this.pin, this.value == 1);
               }
            }
         });
      });
   }
}

GpioPin.prototype.set = function(_value) {

   if (this.writable) {
      this.gpio.write(this.triggerLow ? (_value ? 0 : 1) : (_value ? 1 : 0));
   }
}

module.exports = exports = GpioService;
 
