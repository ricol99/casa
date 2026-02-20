var util = require('util');
var ServiceEvent = require('./serviceevent');

function WhRelayEvent(_config, _owner) {
   var whRelaySource = _config.hasOwnProperty("whRelaySource") ? _config.whRelaySource : _owner.uName;
   _config.id = whRelaySource.replace(/^:+/, "").replace(/:/g, "-");
   _config.serviceType = "source";
   _config.serviceName = _config.hasOwnProperty("serviceName") ? _config.serviceName : _owner.gang.casa.findServiceName("whrelayservice");
   _config.serviceEvent = _config.hasOwnProperty("whRelayEvent") ? _config.whRelayEvent : _config.name;
   _config.serviceArgs = _config.hasOwnProperty("serviceArgs") ? _config.serviceArgs : { whRelaySource: whRelaySource };
   _config.sync = _config.hasOwnProperty("sync") ? _config.sync : "readwrite";

   ServiceEvent.call(this, _config, _owner);
}

util.inherits(WhRelayEvent, ServiceEvent);

module.exports = exports = WhRelayEvent;
 
