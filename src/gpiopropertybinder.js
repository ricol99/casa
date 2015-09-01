var util = require('util');
var Gpio = require('onoff').Gpio;
var PropertyBinder = require('./propertybinder');

function GPIOPropertyBinder(_config, _owner) {

   this.gpioPin = _config.gpioPin;
   this.triggerLow = (_config.triggerLow) ? _config.triggerLow : false;

   PropertyBinder.call(this, _config, _owner);

   this.ready = false;
   this.direction = (this.writable) ? 'out' : 'in';

   var that = this;

   process.on('SIGINT', function() {
      if (that.gpio) {
         that.gpio.unexport();
      }
   });
 
}

util.inherits(GPIOPropertyBinder, PropertyBinder);

GPIOPropertyBinder.prototype.Ready = function() {
   var that = this;
   this.ready = true;

   this.gpio.read( function(_err, _value) {
       that.value = _value;
       that.updatePropertyAfterRead(_value, { sourceName: this.ownerName, coldStart: true });
   });

   this.gpio.watch(function (_err, _value) {

      if (_err) {
         console.log(this.name + ": Error from gpio library! Error = " + _err);
      }
      else {
         console.log(that.name + ': Value changed event received on GPIO Pin ' + that.gpioPin + ' to ' + _value);
         var newValue = that.triggerLow ? (_value == 1 ? 0 : 1) : _value;

         if (newValue != that.value) {
            console.log(that.name + ': Value changed on GPIO Pin ' + that.gpioPin + ' to ' + newValue);
            that.value = newValue;
            that.updatePropertyAfterRead((newValue) ? (this.triggerLow ? false : true) : (this.triggerLow ? true : false), { sourceName: this.sourceName });
         }
      }
   });
}

GPIOPropertyBinder.prototype.setProperty = function(_propValue, _data, _callback) {
   this.set(_propValue, (_propValue) ? (this.triggerLow ? 0 : 1) : (this.triggerLow ? 1 : 0), _data, _callback);
}

GPIOPropertyBinder.prototype.set = function(_propValue, _value, _data, _callback) {
   var that = this;

   if (this.ready && this.writable) {
      this.gpio.write(_value, function (err) {
         if (err) {
            _callback(false);
         }
         else {
            this.updatePropertyAfterRead(_propValue, _data);
            _callback(true);
         }
      });
   }
   else {
      _callback(false);
   }
}

GPIOPropertyBinder.prototype.coldStart = function() {
   var that = this;

   this.gpio = new Gpio(this.gpioPin, this.direction, 'both');
   this.Ready();

   //this.gpio = Gpio.export(this.gpioPin, {
      //direction: this.direction,
      //interval: 100,
      //ready: function() {
         //that.Ready();
      //}
   //});
}

module.exports = exports = GPIOPropertyBinder;
 
