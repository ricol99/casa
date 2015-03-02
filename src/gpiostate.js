var util = require('util');
var Gpio = require('gpio');
var State = require('./state');

function GpioState(_config) {

   this.gpioPin = _config.gpioPin;
   this.triggerLow = (_config.triggerLow) ? _config.triggerLow : false;
   this.writable = (_config.writable) ? _config.writable : false;

   State.call(this, _config);

   this.ready = false;

   var that = this;
   var direction = (this.writable) ? 'out' : 'in';
 
   // Calling export with a pin number will export that header and return a gpio header instance
   this.gpio = Gpio.export(this.gpioPin, {
      direction: direction,
      interval: 400,
      ready: function() {
         that.ready = true;
         that.gpio.on("change", function (value) {
            console.log(that.name + ': Value changed on GPIO Pin ' + that.gpioPin + ' to ' + value);
            value = that.triggerLow ? (value == 1 ? 0 : 1) : value;
            if (value == 1) {
               that.emit('active', { sourceName: that.name });
            }
            else {
               that.emit('inactive', { sourceName: that.name });
            }
         });
      }
   });
}

util.inherits(GpioState, State);

// *TBD* Could we lose events here?
GpioState.prototype.setActive = function(_callback) {
   set(this.triggerLow ? 0 : 1, _callback);
}

GpioState.prototype.setInactive = function(_callback) {
   set(this.triggerLow ? 1 : 0, _callback);
}

GpioState.prototype.set = function(_value, _callback) {
   var that = this;

   if (this.ready && this.writable) {
      this.gpio.set(value, function (err) {
         _callback(err != 0);
      });
   }
   else {
      _callback(false);
   }
}

module.exports = exports = GpioState;
 
