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

// Called when system state is required
PusherProperty.prototype.export = function(_exportObj) {
   ServiceProperty.prototype.export.call(this, _exportObj);
};

// Called to restore system state before hot start
PusherProperty.prototype.import = function(_importObj) {
   ServiceProperty.prototype.import.call(this, _importObj);
};

// Called after system state has been restored
PusherProperty.prototype.hotStart = function() {
   ServiceProperty.prototype.hotStart.call(this);
};

// Called to start a cold system
PusherProperty.prototype.coldStart = function () {
   ServiceProperty.prototype.coldStart.call(this);
};

module.exports = exports = PusherProperty;
 
