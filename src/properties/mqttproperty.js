var util = require('util');
var ServiceProperty = require('./serviceproperty');

function MqttProperty(_config, _owner) {
   _config.id = _config.topic.replace("::", "").replace(/:/g, "-");
   _config.serviceType = "topic";
   _config.serviceName = _config.hasOwnProperty("serviceName") ? _config.serviceName : _owner.gang.casa.findServiceName("mqttservice");
   _config.serviceProperty = _config.hasOwnProperty("smeeProperty") ? _config.smeeProperty : _config.name;
   _config.serviceArgs = _config.hasOwnProperty("serviceArgs") ? _config.serviceArgs : { topic: _config.topic };
   _config.sync = "readwrite";

   ServiceProperty.call(this, _config, _owner);
}

util.inherits(MqttProperty, ServiceProperty);

module.exports = exports = MqttProperty;
 
