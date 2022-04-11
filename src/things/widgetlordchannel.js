var util = require('util');
var Thing = require('../thing');

function WidgetLordChannel(_config, _parent) {
   Thing.call(this, _config, _parent);
   this.thingType = "widget-lord-channel";
   this.displayName = _config.displayName;
   this.channelId = _config.channelId;
   this.interval = (_config.hasOwnProperty("interval")) ? _config.interval : 10000;
   this.serviceName = (_config.hasOwnProperty("serviceName")) ? _config.serviceName :  this.gang.casa.findServiceName("widgetlordservice");

   if (!this.serviceName) {
      console.error(this.uName + ": ***** Widgetlord service not found! *************");
      process.exit();
   }

   this.ensurePropertyExists('reading', 'serviceproperty', { id: this.channelId, serviceType: "channel", serviceName: this.serviceName, sync: "read" }, _config);
   this.ensurePropertyExists('interval', 'serviceproperty', { id: this.channelId, initialValue: this.interval, serviceType: "channel", serviceName: this.serviceName, sync: "write" }, _config);
}

util.inherits(WidgetLordChannel, Thing);

// Called when current state required
WidgetLordChannel.prototype.export = function(_exportObj) {
   Thing.prototype.export.call(this, _exportObj);
};

// Called when current state required
WidgetLordChannel.prototype.import = function(_importObj) {
   Thing.prototype.import.call(this, _importObj);
};

WidgetLordChannel.prototype.coldStart = function() { 
   Thing.prototype.coldStart.call(this);
};

WidgetLordChannel.prototype.hotStart = function() {
   Thing.prototype.hotStart.call(this);
};

module.exports = exports = WidgetLordChannel;
