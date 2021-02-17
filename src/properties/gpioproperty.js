var util = require('util');
var ServiceProperty = require('./serviceproperty');

function GPIOProperty(_config, _owner) {
   _config.id = _config.gpioPin;
   _config.serviceType = "pin";
   _config.serviceProperty = "state";
   _config.serviceName = "gpioservice";
   var direction = (_config.hasOwnProperty("direction")) ? _config.direction : ((this.writable) ? "out" : "in");
   _config.serviceArgs = { triggerLow: _config.hasOwnProperty("triggerLow") ? _config.triggerLow : false, direction: direction };
   _config.sync = (direction === "out") ? "write" : "read";

   ServiceProperty.call(this, _config, _owner);
   this.ready = false;
}

util.inherits(GPIOProperty, ServiceProperty);

module.exports = exports = GPIOProperty;
 
