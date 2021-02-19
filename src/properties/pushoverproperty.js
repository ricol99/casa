var util = require('util');
var ServiceProperty = require('./serviceproperty');

function PushoverProperty(_config, _owner) {
   _config.allSourcesRequiredForValidity = false;
   var split = _config.userGroup.split(":");
   _config.id = split[split.length - 1];
   _config.serviceType = "group";
   _config.serviceProperty = "message";
   _config.serviceName = _config.hasOwnProperty("serviceName") ? _config.serviceName : _owner.gang.casa.findServiceName("pushoverservice");
   _config.serviceArgs = { messagePriority: _config.hasOwnProperty("priority") ? _config.priority : 0,
                           userGroup: _config.userGroup };
   _config.sync = "write";

   console.error("AAAAAAAAAAAAAAAA pushover config=",_config);
   ServiceProperty.call(this, _config, _owner);
}

util.inherits(PushoverProperty, ServiceProperty);

module.exports = exports = PushoverProperty;
 
