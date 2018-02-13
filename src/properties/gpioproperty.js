var util = require('util');
var Gpio = require('onoff').Gpio;
var Property = require('../property');

function GPIOProperty(_config, _owner) {

   this.gpioPin = _config.gpioPin;
   this.triggerLow = (_config.triggerLow) ? _config.triggerLow : false;

   Property.call(this, _config, _owner);

   this.ready = false;
   this.direction = (this.writable) ? 'out' : 'in';

   process.on('SIGINT', () => {
      if (this.gpio) {
         this.gpio.unexport();
      }
   });
 
}

util.inherits(GPIOProperty, Property);

GPIOProperty.prototype.Ready = function() {
   this.ready = true;

   this.gpio.read( (_err, _value) => {
       var newValue = this.triggerLow ? (_value == 1 ? 0 : 1) : _value;
       this.value = newValue;
       this.updatePropertyInternal(newValue == 1, { coldStart: true });
   });

   this.gpio.watch( (_err, _value) => {

      if (_err) {
         console.log(this.uName + ": Error from gpio library! Error = " + _err);
      }
      else {
         var newValue = this.triggerLow ? (_value == 1 ? 0 : 1) : _value;

         if (newValue != this.value) {
            console.log(this.uName + ': Value changed on GPIO Pin ' + this.gpioPin + ' to ' + newValue);
            this.value = newValue;
            this.updatePropertyInternal(newValue == 1);
         }
      }
   });
}

GPIOProperty.prototype.propertyAboutToChange = function(_propValue, _data) {

   if ((this.direction == 'out' || this.direction == 'inout') && (this.value != _propValue)) {
      this.set(_propValue, (_propValue) ? (this.triggerLow ? 0 : 1) : (this.triggerLow ? 1 : 0), _data);
   }
}

GPIOProperty.prototype.set = function(_value, _data) {

   if (this.ready && this.writable) {
      this.gpio.write(_value);
   }
}

GPIOProperty.prototype.coldStart = function() {

   this.gpio = new Gpio(this.gpioPin, this.direction, 'both');
   this.Ready();
}

module.exports = exports = GPIOProperty;
 
