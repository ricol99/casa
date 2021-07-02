var util = require('util');
var Notifier = require('../notifier');

function PushcutNotifier(_config, _parent) {
   var serviceArgs = {};
   
   if (config.hasOwnProperty("sound")) {
      serviceArgs.sound = _config.sound;
   }
   
   if (config.hasOwnProperty("image")) {
      serviceArgs.image = _config.image;
   }
   
   if (config.hasOwnProperty("devices")) {
      serviceArgs.devices = _config.devices;
   }
   
   this.serviceName = (_config.hasOwnProperty("serviceName")) ? _config.serviceName :  this.gang.casa.findServiceName("pushcutservice");

   if (!this.serviceName) {
      console.error(this.uName + ": ***** Pushcut service not found! *************");
      process.exit();
   }

   _config.serviceConfig = { serviceType: "notifier", serviceName: this.serviceName, serviceArgs: serviceArgs };

   Notifier.call(this, _config, _parent);
   this.thingType = "pushcut-notifier";

   this.ensurePropertyExists("pushcut-notifier-state", 'serviceproperty',
                             { id: id, serviceType: "notifier", serviceName: this.serviceName, sync: "readwrite", serviceArgs: serviceArgs,
                               source: { "property": "notifier-state"} }, _config);

   this.props["notifier-state"]._addSource({ property: : "pushcut-notifier-state" });
}

util.inherits(PushcutNotifier, Thing);

module.exports = exports = PushcutNotifier;
