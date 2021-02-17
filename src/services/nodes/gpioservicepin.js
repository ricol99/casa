var util = require('util');
var ServiceNode = require('./servicenode');
var Gpio = require('onoff').Gpio;

function GpioServicePin(_config, _owner) {
   ServiceNode.call(this, _config, _owner);

   this.id = _config.subscription.id;
   this.direction = _config.subscription.direction;
   this.writable = (this.direction === 'out') || (this.direction === 'inout');
   this.triggerLow = _config.subscription.triggerLow;
   this.propertyName = _config.subscription.properties
   this.pinValue = 0;
   console.log(this.uName + ": New GPIO pin node created");

   this.ensurePropertyExists("state", 'property', { initialValue: false, allSourcesRequiredForValidity: false });
}

util.inherits(GpioServicePin, ServiceNode);

GpioServicePin.prototype.coldStart = function() {
   this.gpio = new Gpio(this.id, this.direction, 'both', { activeLow: this.triggerLow });

   process.on('SIGINT', () => {

      if (this.gpio) {
         this.gpio.unexport();
      }
   });

   if ((this.direction === 'in') || (this.direction === 'inout')) {

      this.gpio.read( (_err, _pinValue) => {
         this.pinValue = _pinValue;

         this.gpio.watch( (_err, _pinValue) => {

            if (_err) {
               console.error(this.owner.name + ": Error from gpio library! Error = " + _err);
            }
            else if (_pinValue != this.pinValue) {
               console.log(this.uName + ': Value changed on GPIO Pin ' + this.gpioPin + ' to ' + _pinValue);
               this.pinValue = _pinValue;
               this.alignPropertyValue('state', this.pinValue === 1);
            }
         });
      });
   }
};

GpioServicePin.prototype.setPin = function(_value, _callback) {
   var transaction = { action: "setPin", properties: { state: _value }, callback: _callback };
   this.owner.queueTransaction(this, transaction);
};

GpioServicePin.prototype.getPin = function(_callback) {
   var transaction = { action: "getPin", callback: _callback };
   this.owner.queueTransaction(this, transaction);
};
      
GpioServicePin.prototype.transactionReadyForProcessing = function(_transaction) {
   return true;
};

GpioServicePin.prototype.processPropertyChanged = function(_transaction, _callback) {
   console.log(this.uName + ": processPropertyChanged() transaction=", _transaction.properties);
   this.processSetState(_transaction, _callback);
};

GpioServicePin.prototype.processSetPin = function(_transaction, _callback) {
   console.log(this.uName + ": processSetPin() transaction=", _transaction.properties);

   if (this.writable) {

      this.gpio.write(this.triggerLow ? (_transaction.properties.state ? 0 : 1) : (_transaction.properties.state ? 1 : 0), (_err, _result) => {

         if (!_err) {
            this.alignPropertyValue('state', _transaction.properties.state);
         }
         _callback(_err, _result);
      });
   }
   else {
      _callback("GPIO pin is not writable!");
   }
}

GpioServicePin.prototype.processGetPin = function(_transaction, _callback) {
   this.gpio.read(_callback);
};

module.exports = exports = GpioServicePin;

