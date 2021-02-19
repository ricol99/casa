var util = require('util');
var Gpio = require('onoff').Gpio;
var Service = require('../service');

function GpioService(_config, _owner) {
   _config.queueQuant = 50;
   _config.deviceTypes = { "pin": "gpioservicepin" };
   
   Service.call(this, _config, _owner);
}

util.inherits(GpioService, Service);

GpioService.prototype.setPin = function(_id, _value, _callback) {
   var serviceNode = this.findOrCreateNode("pin", _id);
   serviceNode.setPin(_value, _callback);
};

GpioService.prototype.getPin = function(_id, _callback) {
   var serviceNode = this.findOrCreateNode("pin", _id);
   serviceNode.getPin(_callback);
};

module.exports = exports = GpioService;
 
