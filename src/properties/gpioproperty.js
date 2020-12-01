var util = require('util');
var Gpio = require('onoff').Gpio;
var Property = require('../property');

function GPIOProperty(_config, _owner) {

   this.gpioPin = _config.gpioPin;
   this.triggerLow = _config.hasOwnProperty("triggerLow") ? _config.triggerLow : false;
   this.direction = (_config.hasOwnProperty("direction")) ? _config.direction : ((this.writable) ? 'out' : 'in');
   this.serviceName = (_config.hasOwnProperty("service")) ? _config.service : _owner.gang.casa.findServiceName("gpioservice");

   _config.source = { uName: this.serviceName, property: "gpio-pin-"+this.gpioPin,
                      subscription: { direction: this.direction, triggerLow: this.triggerLow }};

   Property.call(this, _config, _owner);

   this.ready = false;
}

util.inherits(GPIOProperty, Property);

GPIOProperty.prototype.gpioPinStatusChanged = function(_gpioPin, _newValue) {

   if (_newValue != this.value) {
      console.log(this.uName + ': Value changed on GPIO Pin ' + this.gpioPin + ' to ' + _newValue);
      this.updatePropertyInternal(_newValue);
   }
}

GPIOProperty.prototype.newEventReceivedFromSource = function(_sourceListener, _data) {

   if (_data.name === "gpio-pin-"+this.gpioPin) {
      console.log(this.uName + ': Value changed on GPIO Pin ' + this.gpioPin + ' to ' + _data.value);
      this.updatePropertyInternal(_data.value, _data);
   }
};

GPIOProperty.prototype.propertyAboutToChange = function(_propValue, _data) {

   if ((this.direction == 'out' || this.direction == 'inout') && (this.value != _propValue)) {
      var source = this.owner.gang.findGlobalSource(this.serviceName);

      if (source) {
         source.setProperty("gpio-pin-"+this.gpioPin, _propValue, {});
      }
      this.gpio.set(_propValue);
   }
}

module.exports = exports = GPIOProperty;
 
