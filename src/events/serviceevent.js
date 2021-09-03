var util = require('util');
var Event = require('../event');

function ServiceEvent(_config, _owner) {
   this.id = _config.id.toString().replace(/-/g, "");
   this.serviceType = _config.serviceType;
   this.serviceEvent = _config.hasOwnProperty("serviceEvent") ? _config.serviceEvent : _config.name;
   this.serviceName = _config.serviceName;
   this.serviceArgs = _config.hasOwnProperty("serviceArgs") ? _config.serviceArgs : {};
   this.sync = _config.hasOwnProperty("sync") ? _config.sync : "read";

   var sourceName = this.serviceName + ":" + this.serviceType + "-" + this.id;

   if (_config.source) {
      _config.sources = [ _config.source ];
      delete _config.source;
   }

   if (!_config.hasOwnProperty("sources")) {
      _config.sources = [];
   }

   var sourceConfig = { uName: sourceName, event: this.serviceEvent, subscription: { subscriber: _owner.uName, sync: this.sync, args: this.serviceArgs } };

   if (this.sync === "write") {
      sourceConfig.ignoreSourceUpdates = true;
   }

   sourceConfig.subscription.serviceEvent = this.serviceEvent;

   if (this.sync.endsWith("write")) {
      sourceConfig.subscription.subscriberEvent = _config.name;
   }

   _config.sources.push(sourceConfig);

   Event.call(this, _config, _owner);
   this.ready = false;
}

util.inherits(ServiceEvent, Event);

module.exports = exports = ServiceEvent;
 
