var util = require('util');
var Notifier = require('../notifier');

function PushcutNotifier(_config, _parent) {
   var serviceArgs = {};
   
   if (_config.hasOwnProperty("sound")) {
      serviceArgs.sound = _config.sound;
   }
   
   if (_config.hasOwnProperty("image")) {
      serviceArgs.image = _config.image;
   }
   
   if (_config.hasOwnProperty("devices")) {
      serviceArgs.devices = _config.devices;
   }
   
   var serviceName = (_config.hasOwnProperty("serviceName")) ? _config.serviceName :  _parent.gang.casa.findServiceName("pushcutservice");

   if (!serviceName) {
      console.error(this.uName + ": ***** Pushcut service not found! *************");
      process.exit();
   }

   _config.serviceConfig = { serviceType: "notifier", serviceName: serviceName, serviceArgs: serviceArgs };

   Notifier.call(this, _config, _parent);
   this.thingType = "pushcut-notifier";
}

util.inherits(PushcutNotifier, Notifier);

// Called when current state required
PushcutNotifier.prototype.export = function(_exportObj) {
   Notifier.prototype.export.call(this, _exportObj);
};

// Called when current state required
PushcutNotifier.prototype.import = function(_importObj) {
   Notifier.prototype.import.call(this, _importObj);
};

PushcutNotifier.prototype.coldStart = function() {
   Notifier.prototype.coldStart.call(this);
};

PushcutNotifier.prototype.hotStart = function() {
   Notifier.prototype.hotStart.call(this);
};

module.exports = exports = PushcutNotifier;
