var util = require('util');
var ServiceProperty = require('./serviceproperty');

function GPIOProperty(_config, _owner) {
   _config.id = _config.gpioPin;
   _config.serviceType = "pin";
   _config.serviceProperty = "state";
   _config.serviceName = _config.hasOwnProperty("serviceName") ? _config.serviceName : _owner.gang.casa.findServiceName("gpioservice");
   _config.serviceArgs = { triggerLow: _config.hasOwnProperty("triggerLow") ? _config.triggerLow : false };

   var direction = _config.hasOwnProperty("direction") ? _config.direction : "in";
   _config.sync = (direction === "out") ? "write" : "read";

   if (_config.sync === "write") {
      _config.serviceArgs.initialValue = _config.hasOwnProperty("initialValue") ? _config.initialValue : false;
   }

   ServiceProperty.call(this, _config, _owner);
}

util.inherits(GPIOProperty, ServiceProperty);

module.exports = exports = GPIOProperty;
 
