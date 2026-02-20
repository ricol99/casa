var util = require('util');
var ServiceProperty = require('./serviceproperty');

function WhRelayProperty(_config, _owner) {
   var whRelaySource = _config.hasOwnProperty("whRelaySource") ? _config.whRelaySource : _owner.uName;
   _config.id = whRelaySource.replace(/^:+/, "").replace(/:/g, "-");
   _config.serviceType = "source";
   _config.serviceName = _config.hasOwnProperty("serviceName") ? _config.serviceName : _owner.gang.casa.findServiceName("whrelayservice");
   _config.serviceProperty = _config.hasOwnProperty("whRelayProperty") ? _config.whRelayProperty : _config.name;
   _config.serviceArgs = _config.hasOwnProperty("serviceArgs") ? _config.serviceArgs : { whRelaySource: whRelaySource };
   _config.sync = "readwrite";

   ServiceProperty.call(this, _config, _owner);
}

util.inherits(WhRelayProperty, ServiceProperty);

// Called when system state is required
WhRelayProperty.prototype.export = function(_exportObj) {
   ServiceProperty.prototype.export.call(this, _exportObj);
};

// Called to restore system state before hot start
WhRelayProperty.prototype.import = function(_importObj) {
   ServiceProperty.prototype.import.call(this, _importObj);
};

// Called after system state has been restored
WhRelayProperty.prototype.hotStart = function() {
   ServiceProperty.prototype.hotStart.call(this);
};

// Called to start a cold system
WhRelayProperty.prototype.coldStart = function () {
   ServiceProperty.prototype.coldStart.call(this);
};

module.exports = exports = WhRelayProperty;
 
