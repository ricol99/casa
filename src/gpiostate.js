var util = require('util');
var Gpio = require('gpio');
var State = require('./state');

function GpioState(_config) {

   this.gpioPin = _config.gpioPin;
   this.triggerLow = (_config.triggerLow) ? _config.triggerLow : false;
   this.writable = (_config.writable) ? _config.writable : false;

   State.call(this, _config);

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

util.inherits(GpioState, State);

GpioState.prototype.Ready = function() {
   var that = this;
   this.ready = true;

   this.gpio.on("change", function (_value) {
      console.log(that.name + ': Value changed event received on GPIO Pin ' + that.gpioPin + ' to ' + _value);
      var newValue = that.triggerLow ? (_value == 1 ? 0 : 1) : _value;

      if (that.cStart) {
         that.cStart = false;
         that.value = !_value;
      }

      if (newValue != that.value) {
         console.log(that.name + ': Value changed on GPIO Pin ' + that.gpioPin + ' to ' + _value);
         that.value = newValue;

         if (newValue == 1) {
            that.active = true;
            that.emit('active', { sourceName: that.name });
         }
         else {
            that.active = false;
            that.emit('inactive', { sourceName: that.name });
         }
      }
   });
}


// *TBD* Could we lose events here?
GpioState.prototype.setActive = function(_callback) {
   this.set(this.triggerLow ? 0 : 1, _callback);
}

GpioState.prototype.setInactive = function(_callback) {
   this.set(this.triggerLow ? 1 : 0, _callback);
}

GpioState.prototype.set = function(_value, _callback) {
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

module.exports = exports = GpioState;
 
