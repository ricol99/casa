var util = require('util');
var Gpio = require('gpio');
var PropertyBinder = require('./propertybinder');

function GPIOPropertyBinder(_config, _source) {

   this.gpioPin = _config.gpioPin;
   this.triggerLow = (_config.triggerLow) ? _config.triggerLow : false;

   PropertyBinder.call(this, _config, _source);

   this.ready = false;
   this. direction = (this.writable) ? 'out' : 'in';

   var that = this;
 
}

util.inherits(GPIOPropertyBinder, PropertyBinder);

GPIOPropertyBinder.prototype.Ready = function() {
   var that = this;
   this.ready = true;

   this.gpio.read( function(_err, _value) {
       that.value = _value;
       this.updatePropertyAfterRead(_value, { sourceName: this.source.name, coldStart: true });
   });

   this.gpio.on("change", function (_value) {
      console.log(that.name + ': Value changed event received on GPIO Pin ' + that.gpioPin + ' to ' + _value);
      var newValue = that.triggerLow ? (_value == 1 ? 0 : 1) : _value;

      if (newValue != that.value) {
         console.log(that.name + ': Value changed on GPIO Pin ' + that.gpioPin + ' to ' + newValue);
         that.value = newValue;
         that.updatePropertyAfterRead(that.triggerLow ? (newValue == 1 ? false : true) : newValue == 1, { sourceName: this.sourceName });
      }
   });
}

GPIOPropertyBinder.prototype.setProperty = function(_propValue, _data, _callback) {
   this.set(_propValue, (_propValue) ? (this.triggerLow ? 0 : 1) : (this.triggerLow ? 1 : 0), _data, _callback);
}

GPIOPropertyBinder.prototype.set = function(_propValue, _value, _data, _callback) {
   var that = this;

   if (this.ready && this.writable) {
      this.gpio.set(_value, function (err) {
         if (err == _value) {
            this.updatePropertyAfterRead(_propValue, _data);
            _callback(true);
         }
         else {
            _callback(false);
         }
      });
   }
   else {
      _callback(false);
   }
}

GPIOPropertyBinder.prototype.coldStart() {
   var that = this;

   this.gpio = Gpio.export(this.gpioPin, {
      direction: this.direction,
      interval: 100,
      ready: function() {
         that.Ready();
      }
   });
}
module.exports = exports = GPIOPropertyBinder;
 
