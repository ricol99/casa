var util = require('util');
var ServiceProperty = require('./serviceproperty');

function PusherProperty(_config, _owner) {
   _config.id = _config.pusherSource.replace("::", "").replace(/:/g, "-");
   _config.serviceType = "source";
   _config.serviceName = _config.hasOwnProperty("serviceName") ? _config.serviceName : _owner.gang.casa.findServiceName("pusherservice");
   _config.serviceArgs = _config.hasOwnProperty("serviceArgs") ? _config.serviceArgs : { pusherSource: _config.pusherSource };
   _config.sync = "read";

   ServiceProperty.call(this, _config, _owner);
}

util.inherits(PusherProperty, ServiceProperty);

module.exports = exports = PusherProperty;
 
