var util = require('util');
var Gpio = require('gpio');
var PropertyBinder = require('./propertybinder');

function GPIOPropertyBinder(_config, _source) {

   this.gpioPin = _config.gpioPin;
   this.triggerLow = (_config.triggerLow) ? _config.triggerLow : false;

   PropertyBinder.call(this, _config, _source);

   this.ready = false;
   this.cStart = true;

   var that = this;
   var direction = (this.writable) ? 'out' : 'in';
 
   // Calling export with a pin number will export that header and return a gpio header instance
   this.gpio = Gpio.export(this.gpioPin, {
      direction: direction,
      interval: 400,
      ready: function() {
         that.Ready();
      }
   });
}

util.inherits(GPIOPropertyBinder, PropertyBinder);

GPIOPropertyBinder.prototype.Ready = function() {
   var that = this;
   this.ready = true;

   this.gpio.on("change", function (_value) {
      console.log(that.name + ': Value changed event received on GPIO Pin ' + that.gpioPin + ' to ' + _value);
      var newValue = that.triggerLow ? (_value == 1 ? 0 : 1) : _value;

      if (that.cStart) {
         that.cStart = false;
         that.value = !newValue;
      }

      if (newValue != that.value) {
         console.log(that.name + ': Value changed on GPIO Pin ' + that.gpioPin + ' to ' + newValue);
         that.value = newValue;
         that.updatePropertyAfterRead(newValue == 1);
      }
   });
}

PropertyBinder.prototype.setProperty = function(_propValue, _callback) {
   this.set((_propValue) ? (this.triggerLow ? 0 : 1) : (this.triggerLow ? 1 : 0), _callback);
}

GPIOPropertyBinder.prototype.set = function(_value, _callback) {
   var that = this;

   if (this.ready && this.writable) {
      this.gpio.set(_value, function (err) {
         _callback(err == _value);
      });
   }
   else {
      _callback(false);
   }
}

module.exports = exports = GPIOPropertyBinder;
 
