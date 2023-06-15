var util = require('../../util');
var ServiceNode = require('../../servicenode');
var Gpio = require('onoff').Gpio;

function GpioServicePin(_config, _owner) {
   ServiceNode.call(this, _config, _owner);

   this.direction = "in";
   this.triggerLow = true;
   this.pinValue = 0;
   this.writable = false;

   console.log(this.uName + ": New GPIO pin node created");
   this.ready = false;
   this.listening = false;

   this.ensurePropertyExists("state", 'property', { initialValue: false, allSourcesRequiredForValidity: false });
}

util.inherits(GpioServicePin, ServiceNode);

// Called when current state required
GpioServicePin.prototype.export = function(_exportObj) {
   ServiceNode.prototype.export.call(this, _exportObj);
};

// Called when current state required
GpioServicePin.prototype.import = function(_importObj) {
   ServiceNode.prototype.import.call(this, _importObj);
};

GpioServicePin.prototype.coldStart = function() {
   ServiceNode.prototype.coldStart.call(this);
};

GpioServicePin.prototype.hotStart = function() {
   ServiceNode.prototype.hotStart.call(this);
};

GpioServicePin.prototype.newSubscriptionAdded = function(_subscription) {

   if (!this.ready) {
      let map = { read: "in", write: "out", readwrite: "in" };
      this.direction = map[_subscription.sync];
      this.triggerLow = _subscription.args.triggerLow;
      var initialDirection = this.direction;

      if ((this.direction === "out") && _subscription.args.hasOwnProperty("initialValue")) {
         initialDirection = this.triggerLow ? (_subscription.args.initialValue ? "low" : "high") : (_subscription.args.initialValue ? "high" : "low");
      }

      this.writable = (this.direction === "out");
      this.gpio = new Gpio(this.id, initialDirection, 'both', { activeLow: this.triggerLow });
      this.ready = true;
   }

   if ((this.direction === "in") && !this.listening) {
      this.startListening();
   }
};

GpioServicePin.prototype.startListening = function() {
   this.listening = true;

   process.on('SIGINT', () => {

      if (this.gpio) {
         this.gpio.unexport();
      }
   });

   if (this.direction === 'in') {

      this.gpio.read( (_err, _pinValue) => {
         this.pinValue = _pinValue;
         this.alignPropertyValue('state', this.pinValue === 1);

         this.gpio.watch( (_err, _pinValue) => {

            if (_err) {
               console.error(this.owner.name + ": Error from gpio library! Error = " + _err);
            }
            else if (_pinValue != this.pinValue) {
               console.log(this.uName + ': Value changed on GPIO Pin ' + this.id + ' to ' + _pinValue);
               this.pinValue = _pinValue;
               this.alignPropertyValue('state', this.pinValue === 1);
            }
         });
      });
   }
};

GpioServicePin.prototype.setState = function(_value, _callback) {
   var transaction = { action: "setState", properties: { state: _value }, callback: _callback };
   this.owner.queueTransaction(this, transaction);
};

GpioServicePin.prototype.getState = function(_callback) {
   var transaction = { action: "getState", callback: _callback };
   this.owner.queueTransaction(this, transaction);
};
      
GpioServicePin.prototype.transactionReadyForProcessing = function(_transaction) {
   return true;
};

GpioServicePin.prototype.processPropertyChanged = function(_transaction, _callback) {
   console.log(this.uName + ": processPropertyChanged() transaction=", _transaction.properties);
   this.processSetState(_transaction, _callback);
};

GpioServicePin.prototype.processSetState = function(_transaction, _callback) {
   console.log(this.uName + ": processSetState() transaction=", _transaction.properties);

   if (this.ready) {

      if (this.writable) {

         //this.gpio.write(this.triggerLow ? (_transaction.properties.state ? 0 : 1) : (_transaction.properties.state ? 1 : 0), (_err, _result) => {
         this.gpio.write(_transaction.properties.state ? 1 : 0, (_err, _result) => {

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
}

GpioServicePin.prototype.processGetState = function(_transaction, _callback) {
   this.gpio.read(_callback);
};

module.exports = exports = GpioServicePin;

