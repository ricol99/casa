var util = require('util');
var Gpio = require('onoff').Gpio;
var Service = require('../service');

function GpioService(_config, _owner) {
   _config.queueQuant = 50;
   _config.deviceTypes = { "pin": "gpioservicepin" };
   
   Service.call(this, _config, _owner);
}

util.inherits(GpioService, Service);

// Called when current state required
GpioService.prototype.export = function(_exportObj) {
   Service.prototype.export.call(this, _exportObj);
};

// Called when current state required
GpioService.prototype.import = function(_importObj) {
   Service.prototype.import.call(this, _importObj);
};

GpioService.prototype.coldStart = function() {
   Service.prototype.coldStart.call(this);
};

GpioService.prototype.hotStart = function() {
   Service.prototype.hotStart.call(this);
};

GpioService.prototype.setPin = function(_id, _value, _callback) {
   var serviceNode = this.findOrCreateNode("pin", _id);
   serviceNode.setPin(_value, _callback);
};

GpioService.prototype.getPin = function(_id, _callback) {
   var serviceNode = this.findOrCreateNode("pin", _id);
   serviceNode.getPin(_callback);
};

module.exports = exports = GpioService;
 
