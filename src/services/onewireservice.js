var util = require('util');
var w1bus = require('node-w1bus');
var Service = require('../service');

function OneWireService(_config, _owner) {
   Service.call(this, _config, _owner);

   this.deviceTypes = {
      "10": "onewireservicethermometer",
      "22": "onewireservicethermometer",
      "28": "onewireservicethermometer"
   };

   this.devices = {};
}

util.inherits(OneWireService, Service);

// Called when current state required
OneWireService.prototype.export = function(_exportObj) {
   Service.prototype.export.call(this, _exportObj);
};

// Called when current state required
OneWireService.prototype.import = function(_importObj) {
   Service.prototype.import.call(this, _importObj);
};

OneWireService.prototype.coldStart = function() {
   this.start();
   Service.prototype.coldStart.call(this);
};

OneWireService.prototype.hotStart = function() {
   this.start();
   Service.prototype.hotStart.call(this);
};

OneWireService.prototype.start = function() {
   this.oneWireBus = w1bus.create();
};

 module.exports = exports = OneWireService;
