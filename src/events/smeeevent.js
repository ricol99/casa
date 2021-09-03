var util = require('util');
var ServiceEvent = require('./serviceevent');

function SmeeEvent(_config, _owner) {
   var smeeSource = _config.hasOwnProperty("smeeSource") ? _config.smeeSource : _owner.uName;
   _config.id = smeeSource.replace("::", "").replace(/:/g, "-");
   _config.serviceType = "source";
   _config.serviceName = _config.hasOwnProperty("serviceName") ? _config.serviceName : _owner.gang.casa.findServiceName("smeeservice");
   _config.serviceEvent = _config.hasOwnProperty("smeeEvent") ? _config.smeeEvent : _config.name;
   _config.serviceArgs = _config.hasOwnProperty("serviceArgs") ? _config.serviceArgs : { smeeSource: smeeSource };
   _config.sync = _config.hasOwnProperty("sync") ? _config.sync : "readwrite";

   ServiceEvent.call(this, _config, _owner);
}

util.inherits(SmeeEvent, ServiceEvent);

module.exports = exports = SmeeEvent;
 
