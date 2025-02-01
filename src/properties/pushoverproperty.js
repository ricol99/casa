var util = require('util');
var ServiceProperty = require('./serviceproperty');

function PushoverProperty(_config, _owner) {
   _config.allSourcesRequiredForValidity = false;
   var split = _config.userGroup.split(":");
   _config.id = split[split.length - 1];
   _config.serviceType = "group";
   //_config.serviceProperty = "message";
   _config.serviceName = _config.hasOwnProperty("serviceName") ? _config.serviceName : _owner.gang.casa.findServiceName("pushoverservice");
   _config.serviceArgs = { messagePriority: _config.hasOwnProperty("priority") ? _config.priority : 0,
                           userGroup: _config.userGroup, msgFormat: _config.msgFormat };
   _config.sync = "write";

   ServiceProperty.call(this, _config, _owner);
   this.messagePriority = _config.hasOwnProperty("priority") ? _config.priority : 0;
}

util.inherits(PushoverProperty, ServiceProperty);

// Called when system state is required
PushoverProperty.prototype.export = function(_exportObj) {
   ServiceProperty.prototype.export.call(this, _exportObj);
};

// Called to restore system state before hot start
PushoverProperty.prototype.import = function(_importObj) {
   ServiceProperty.prototype.import.call(this, _importObj);
};

// Called after system state has been restored
PushoverProperty.prototype.hotStart = function() {
   ServiceProperty.prototype.hotStart.call(this);
};

// Called to start a cold system
PushoverProperty.prototype.coldStart = function () {
   ServiceProperty.prototype.coldStart.call(this);
};

PushoverProperty.prototype.newEventReceivedFromSource = function(_sourceListener, _data) {
   _data.messagePriority = this.messagePriority;
   ServiceProperty.prototype.newEventReceivedFromSource.call(this, _sourceListener, _data);
};

module.exports = exports = PushoverProperty;
 
