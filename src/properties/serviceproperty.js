var util = require('util');
var Property = require('../property');

function ServiceProperty(_config, _owner) {
   this.id = _config.id.toString().replace(/-/g, "");
   this.serviceType = _config.serviceType;
   this.serviceProperty = _config.hasOwnProperty("serviceProperty") ? _config.serviceProperty : _config.name;
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

   var sourceConfig = { uName: sourceName, property: this.serviceProperty, subscription: { subscriber: _owner.uName, sync: this.sync, args: this.serviceArgs } };

   if (this.sync === "write") {
      sourceConfig.ignoreSourceUpdates = true;
   }

   if (this.sync.endsWith("write")) {
      sourceConfig.subscription.serviceProperty = this.serviceProperty;
      sourceConfig.subscription.subscriberProperty = _config.name;
   }

   _config.sources.push(sourceConfig);

   Property.call(this, _config, _owner);
   this.ready = false;
}

util.inherits(ServiceProperty, Property);

module.exports = exports = ServiceProperty;
 
