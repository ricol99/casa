var util = require('util');
var ServiceEvent = require('./serviceevent');

function PushoverEvent(_config, _owner) {
   _config.allSourcesRequiredForValidity = false;
   var split = _config.userGroup.split(":");
   _config.id = split[split.length - 1];
   _config.serviceType = "group";
   //_config.serviceEvent = "pushoverEvent";
   _config.serviceName = _config.hasOwnProperty("serviceName") ? _config.serviceName : _owner.gang.casa.findServiceName("pushoverservice");
   _config.serviceArgs = { messagePriority: _config.hasOwnProperty("priority") ? _config.priority : 0, userGroup: _config.userGroup, msgFormat: _config.msgFormat };
   _config.sync = "write";

   ServiceEvent.call(this, _config, _owner);
   this.messagePriority = _config.hasOwnProperty("priority") ? _config.priority : 0;
}

util.inherits(PushoverEvent, ServiceEvent);

PushoverEvent.prototype.newEventReceivedFromSource = function(_sourceListener, _data) {
   _data.messagePriority = this.messagePriority;
   ServiceEvent.prototype.newEventReceivedFromSource.call(this, _sourceListener, _data);
};

module.exports = exports = PushoverEvent;
 
