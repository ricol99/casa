var util = require('util');
var ServiceProperty = require('./serviceproperty');

function SmeeProperty(_config, _owner) {
   _config.id = _config.smeeSource.replace("::", "").replace(/:/g, "-");
   _config.serviceType = "source";
   _config.serviceName = _config.hasOwnProperty("serviceName") ? _config.serviceName : _owner.gang.casa.findServiceName("smeeservice");
   _config.serviceArgs = _config.hasOwnProperty("serviceArgs") ? _config.serviceArgs : { smeeSource: _config.smeeSource };
   _config.sync = "read";

   ServiceProperty.call(this, _config, _owner);
}

util.inherits(SmeeProperty, ServiceProperty);

module.exports = exports = SmeeProperty;
 
