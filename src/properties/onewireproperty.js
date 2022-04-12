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

// Called when system state is required
OneWireProperty.prototype.export = function(_exportObj) {
   ServiceProperty.prototype.export.call(this, _exportObj);
};

// Called to restore system state before hot start
OneWireProperty.prototype.import = function(_importObj) {
   ServiceProperty.prototype.import.call(this, _importObj);
};

// Called after system state has been restored
OneWireProperty.prototype.hotStart = function() {
   ServiceProperty.prototype.hotStart.call(this);
};

// Called to start a cold system
OneWireProperty.prototype.coldStart = function () {
   ServiceProperty.prototype.coldStart.call(this);
};

module.exports = exports = OneWireProperty;
 
