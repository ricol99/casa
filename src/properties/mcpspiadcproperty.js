var util = require('util');
var ServiceProperty = require('./serviceproperty');

function McpSpiAdcProperty(_config, _owner) {
   _config.id = _config.channel;
   _config.serviceType = "channel";
   _config.serviceProperty = "reading";
   _config.serviceName = _config.hasOwnProperty("serviceName") ? _config.serviceName : _owner.gang.casa.findServiceName("mcpspiadcservice");
   _config.serviceArgs = { interval: _config.hasOwnProperty("interval") ? _config.interval : 10000 };
   _config.sync = "read";

   ServiceProperty.call(this, _config, _owner);
}

util.inherits(McpSpiAdcProperty, ServiceProperty);

module.exports = exports = McpSpiAdcProperty;
 
