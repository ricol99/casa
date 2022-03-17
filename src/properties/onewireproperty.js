var util = require('util');
var ServiceProperty = require('./serviceproperty');

function OneWireProperty(_config, _owner) {
   _config.id = _config.deviceId;
   _config.serviceType = _config.deviceType;
   _config.serviceProperty = _config.hasOwnProperty("serviceProperty") ? _config.serviceProperty : "state";
   _config.serviceName = _config.hasOwnProperty("serviceName") ? _config.serviceName : _owner.gang.casa.findServiceName("onewireservice");
   _config.serviceArgs = _config.hasOwnProperty("serviceArgs") ? _config.serviceArgs : {};
   _config.sync = _config.hasOwnProperty("sync") ? _config.sync : "read";

   ServiceProperty.call(this, _config, _owner);
}

util.inherits(OneWireProperty, ServiceProperty);

module.exports = exports = OneWireProperty;
 
