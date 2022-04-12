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

// Called when system state is required
GPIOProperty.prototype.export = function(_exportObj) {
   ServiceProperty.prototype.export.call(this, _exportObj);
};

// Called to restore system state before hot start
GPIOProperty.prototype.import = function(_importObj) {
   ServiceProperty.prototype.import.call(this, _importObj);
};

// Called after system state has been restored
GPIOProperty.prototype.hotStart = function() {
   ServiceProperty.prototype.hotStart.call(this);
};

// Called to start a cold system
GPIOProperty.prototype.coldStart = function () {
   ServiceProperty.prototype.coldStart.call(this);
};

module.exports = exports = GPIOProperty;
 
