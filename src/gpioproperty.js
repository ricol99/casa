var util = require('util');
var Gpio = require('onoff').Gpio;
var Property = require('./property');

function GPIOProperty(_config, _owner) {

   this.gpioPin = _config.gpioPin;
   this.triggerLow = (_config.triggerLow) ? _config.triggerLow : false;

   Property.call(this, _config, _owner);

   this.ready = false;
   this.direction = (this.writable) ? 'out' : 'in';

   var that = this;

   process.on('SIGINT', function() {
      if (that.gpio) {
         that.gpio.unexport();
      }
   });
 
}

util.inherits(GPIOProperty, Property);

GPIOProperty.prototype.Ready = function() {
   var that = this;
   this.ready = true;

   this.gpio.read( function(_err, _value) {
       var newValue = that.triggerLow ? (_value == 1 ? 0 : 1) : _value;
       that.value = newValue;
       that.updatePropertyInternal((newValue) ? (this.triggerLow ? false : true) : (this.triggerLow ? true : false), { sourceName: this.owner.uName, coldStart: true });
   });

   this.gpio.watch(function (_err, _value) {

      if (_err) {
         console.log(this.name + ": Error from gpio library! Error = " + _err);
      }
      else {
         var newValue = that.triggerLow ? (_value == 1 ? 0 : 1) : _value;

         if (newValue != that.value) {
            console.log(that.name + ': Value changed on GPIO Pin ' + that.gpioPin + ' to ' + newValue);
            that.value = newValue;
            that.updatePropertyInternal((newValue) ? (this.triggerLow ? false : true) : (this.triggerLow ? true : false));
         }
      }
   });
}

GPIO.prototype.propertyAboutToChange = function(_propValue, _data) {

   if ((this.direction == 'out' || this.direction == 'inout') && (that.value != _propValue)) {
      this.set(_propValue, (_propValue) ? (this.triggerLow ? 0 : 1) : (this.triggerLow ? 1 : 0), _data);
   }
}

GPIO.prototype.set = function(_value, _data) {
   var that = this;

   if (this.ready && this.writable) {
      this.gpio.write(_value);
   }
}

GPIOProperty.prototype.coldStart = function() {
   var that = this;

   this.gpio = new Gpio(this.gpioPin, this.direction, 'both');
   this.Ready();
}

module.exports = exports = GPIOProperty;
 
