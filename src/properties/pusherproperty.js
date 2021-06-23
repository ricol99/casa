var util = require('util');
var ServiceProperty = require('./serviceproperty');

function PusherProperty(_config, _owner) {
   _config.id = _config.thingName.replace(/:/g, "-");
   _config.serviceType = "thing";
   _config.serviceProperty = _config.hasOwnProperty("serviceProperty") ? _config.serviceProperty : _config.name;
   _config.serviceName = _config.hasOwnProperty("serviceName") ? _config.serviceName : _owner.gang.casa.findServiceName("pusherservice");
   _config.serviceArgs = _config.hasOwnProperty("serviceArgs") ? _config.serviceArgs : { thingName: _config.thingName, property: _config.thingProperty };
   _config.sync = "read";

   ServiceProperty.call(this, _config, _owner);
}

util.inherits(PusherProperty, ServiceProperty);

module.exports = exports = PusherProperty;
 
