var util = require('util');
var Thing = require('../thing');

function KasaPlug(_config, _parent) {
   Thing.call(this, _config, _parent);
   this.thingType = "kasa-plug";
   this.displayName = _config.displayName;

   if (_config.hasOwnProperty("host")) {
      var port = _config.hasOwnProperty("port") ? _config.port : 9999;
      this.deviceId = _config.host+"-"+port;
      this.host = _config.host;
      this.port = port;
   }
   else {
      this.deviceId = _config.alias.toString().replace(/[- :]/g, "");
      this.alias = _config.alias;
   }
   this.serviceName = (_config.hasOwnProperty("serviceName")) ? _config.serviceName :  this.gang.casa.findServiceName("kasaservice");

   if (!this.serviceName) {
      console.error(this.uName + ": ***** Kasa service not found! *************");
      process.exit();
   }

   this.ensurePropertyExists('power', 'serviceproperty', { initialValue: false, id: this.deviceId, serviceType: "plug",
                                                           serviceName: this.serviceName, sync: "write", serviceArgs: { host: this.host, port: this.port, alias: this.alias } }, _config);
}

util.inherits(KasaPlug, Thing);

// Called when current state required
KasaPlug.prototype.export = function(_exportObj) {
   Thing.prototype.export.call(this, _exportObj);
};

// Called when current state required
KasaPlug.prototype.import = function(_importObj) {
   Thing.prototype.import.call(this, _importObj);
};

KasaPlug.prototype.coldStart = function() {
   Thing.prototype.coldStart.call(this);
};

KasaPlug.prototype.hotStart = function() {
   Thing.prototype.hotStart.call(this);
};

module.exports = exports = KasaPlug;
