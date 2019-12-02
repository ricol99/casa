var util = require('util');
var Gpio = require('onoff').Gpio;
var Property = require('../property');

function GPIOProperty(_config, _owner) {

   this.gpioPin = _config.gpioPin;
   this.triggerLow = (_config.triggerLow) ? _config.triggerLow : false;

   Property.call(this, _config, _owner);

   this.ready = false;
   this.direction = (_config.hasOwnProperty("direction")) ? _config.direction : ((this.writable) ? 'out' : 'in');

   this.gpioService =  this.owner.gang.casa.findService("gpioservice");

   if (!this.gpioService) {
      console.error(this.uName + ": ***** GpioService service not found! *************");
      process.exit(1);
   }
}

util.inherits(GPIOProperty, Property);

GPIOProperty.prototype.gpioPinStatusChanged = function(_gpioPin, _newValue) {

   if (_newValue != this.value) {
      console.log(this.uName + ': Value changed on GPIO Pin ' + this.gpioPin + ' to ' + _newValue);
      this.updatePropertyInternal(_newValue);
   }
}

GPIOProperty.prototype.propertyAboutToChange = function(_propValue, _data) {

   if ((this.direction == 'out' || this.direction == 'inout') && (this.value != _propValue)) {
      this.gpio.set(this.value);
   }
}

GPIOProperty.prototype.coldStart = function() {
   this.gpio = this.gpioService.createPin(this, this.gpioPin, this.direction, this.triggerLow);
   Property.prototype.coldStart.call(this);
}

module.exports = exports = GPIOProperty;
 
