var util = require('util');
var ServiceProperty = require('./serviceproperty');

function SmeeProperty(_config, _owner) {
   var smeeSource = _config.hasOwnProperty("smeeSource") ? _config.smeeSource : _owner.uName;
   _config.id = smeeSource.replace("::", "").replace(/:/g, "-");
   _config.serviceType = "source";
   _config.serviceName = _config.hasOwnProperty("serviceName") ? _config.serviceName : _owner.gang.casa.findServiceName("smeeservice");
   _config.serviceProperty = _config.hasOwnProperty("smeeProperty") ? _config.smeeProperty : _config.name;
   _config.serviceArgs = _config.hasOwnProperty("serviceArgs") ? _config.serviceArgs : { smeeSource: smeeSource };
   _config.sync = "readwrite";

   ServiceProperty.call(this, _config, _owner);
}

util.inherits(SmeeProperty, ServiceProperty);

// Called when system state is required
SmeeProperty.prototype.export = function(_exportObj) {
   ServiceProperty.prototype.export.call(this, _exportObj);
};

// Called to restore system state before hot start
SmeeProperty.prototype.import = function(_importObj) {
   ServiceProperty.prototype.import.call(this, _importObj);
};

// Called after system state has been restored
SmeeProperty.prototype.hotStart = function() {
   ServiceProperty.prototype.hotStart.call(this);
};

// Called to start a cold system
SmeeProperty.prototype.coldStart = function () {
   ServiceProperty.prototype.coldStart.call(this);
};

module.exports = exports = SmeeProperty;
 
