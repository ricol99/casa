var util = require('util');
var Gpio = require('gpio');
var State = require('./state');

function GpioState(_name, _gpioPin, _triggerLow, _thing) {

   this.gpioPin = 0;
   this.triggerLow = false;
   this.writable = false;

   if (_name.name) {
      // constructing from object rather than params
      this.gpioPin = _name.gpioPin;
      this.triggerLow = _name.triggerLow;

      if (_name.writable) {
         this.writable = _name.writable;
      }

      State.call(this, _name.name, _name.owner);
   }
   else {
      this.gpioPin = _gpioPin;
      this.triggerLow = _triggerLow;
      State.call(this, _name, _thing);
   }

   that.ready = false;

   var that = this;
   var direction = (this.writable) ? 'out' : 'in';
 
   // Calling export with a pin number will export that header and return a gpio header instance
   this.gpio = Gpio.export(this.gpioPin, {
      direction: direction,
      interval: 400,
      ready: function() {
         that.ready = true;
         gpio.on("change", function (value) {
            console.log(that.name + ': Value changed on GPIO Pin ' + that.gpioPin + ' to ' + value);
            value = that.triggerLow ? (value == 1 ? 0 : 1) : value;
            if (value == 1) {
               that.emit('active', that.name);
            }
            else {
               that.emit('inactive', that.name);
            }
         });
      }
   });
}

util.inherits(GpioState, State);

// *TBD* Could we lose events here?
GpioState.prototype.setActive(_callback) {
   set(this.triggerLow ? 0 : 1, _callback);
}

GpioState.prototype.setInActive(_callback) {
   set(this.triggerLow ? 1 : 0, _callback);
}

GpioState.prototype.set(_value, _callback) {
   var that = this;

   if (this.ready && this.writable) {
      gpio.set(value, function (err) {
         _callback(err != 0);
      });
   }
   else {
      _callback(false);
   }
}

module.exports = exports = GpioState;
 
