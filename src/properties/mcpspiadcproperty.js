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

// Called when system state is required
McpSpiAdcProperty.prototype.export = function(_exportObj) {
   ServiceProperty.prototype.export.call(this, _exportObj);
};

// Called to restore system state before hot start
McpSpiAdcProperty.prototype.import = function(_importObj) {
   ServiceProperty.prototype.import.call(this, _importObj);
};

// Called after system state has been restored
McpSpiAdcProperty.prototype.hotStart = function() {
   ServiceProperty.prototype.hotStart.call(this);
};

// Called to start a cold system
McpSpiAdcProperty.prototype.coldStart = function () {
   ServiceProperty.prototype.coldStart.call(this);
};


module.exports = exports = McpSpiAdcProperty;
 
