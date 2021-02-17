var util = require('util');
var Property = require('../property');

function ServiceProperty(_config, _owner) {
   this.id = _config.id;
   this.serviceType = _config.serviceType;
   this.serviceProperty = _config.hasOwnProperty("serviceProperty") ? _config.serviceProperty : _config.name;
   this.serviceName = _owner.gang.casa.findServiceName(_config.serviceName);
   this.serviceArgs = _config.hasOwnProperty("serviceArgs") ? _config.serviceArgs : {};
   this.sync = _config.hasOwnProperty("sync") ? _config.sync : "read";

   var sourceName = this.serviceName + ":" + this.serviceType + "-" + this.id;
   _config.source = { uName: sourceName, property: this.serviceProperty, subscription: { subscriber: _owner.uName, sync: this.sync, args: this.serviceArgs } };

   if (this.sync === "write") {
      _config.source.ignoreSourceUpdates = true;
   }

   if (this.sync.endsWith("write")) {
      _config.source.subscription.serviceProperty = this.serviceProperty;
      _config.source.subscription.subscriberProperty = _config.name;
   }

   Property.call(this, _config, _owner);
   this.ready = false;
}

util.inherits(ServiceProperty, Property);

module.exports = exports = ServiceProperty;
 
