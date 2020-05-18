var util = require('util');
var Gpio = require('onoff').Gpio;
var Service = require('../service');

function GpioService(_config, _owner) {
   Service.call(this, _config, _owner);
   this.gpios = {};
}

util.inherits(GpioService, Service);

GpioService.prototype.propertySubscribedTo = function(_property, _subscription, _exists) {

   if (!_exists && _subscription.prop.startsWith("gpio-pin-")) {
      this.ensurePropertyExists(_subscription.prop, 'property', { initialValue: false, }, this.config);
      this.createPin(this, _subscription.prop.split("-")[2], _subscription.direction, _subscription.triggerLow); 
   }
};

GpioService.prototype.createPin = function(_owner, _pin, _direction, _triggerLow) {
   var gpio = new GpioPin(_owner, _pin, _direction, _triggerLow);
   this.gpios[_pin] = { gpio: gpio, owner: _owner };
   gpio.start();
   return gpio;
};

GpioService.prototype.gpioPinStatusChanged = function(_pin, _value) {
   this.alignPropertyValue("gpio-pin-"+_pin, _value);
};

GpioService.prototype.propertyAboutToChange = function(_propName, _propValue, _data) {
   var pin = _propName.split("-")[2];
   
   if (this.gpios.hasOwnProperty(pin)) {
      this.gpios[pin].gpio.set(_propValue);
   }
};

function GpioPin(_owner, _pin, _direction, _triggerLow) {
   this.owner = _owner;
   this.gpioPin = _pin;
   this.direction = _direction;
   this.triggerLow = (_triggerLow == undefined) ? true :_triggerLow;
   this.writable = (this.direction === 'out') || (this.direction === 'inout');
   this.value = false;

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
               console.error(this.owner.name + ": Error from gpio library! Error = " + _err);
            }
            else {
               var newValue = this.triggerLow ? (_value == 1 ? 0 : 1) : _value;

               if (newValue != this.value) {
                  console.log(this.owner.name + ': Value changed on GPIO Pin ' + this.gpioPin + ' to ' + newValue);
                  this.value = newValue;
                  this.owner.gpioPinStatusChanged(this.gpioPin, this.value == 1);
               }
            }
         });
      });
   }
}

GpioPin.prototype.set = function(_value) {

   if (this.value !== _value && this.writable) {
      this.value = _value;
      this.gpio.write(this.triggerLow ? (_value ? 0 : 1) : (_value ? 1 : 0));
   }
}

module.exports = exports = GpioService;
 
