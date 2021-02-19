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

OneWireService.prototype.coldStart = function() {
   this.oneWireBus = w1bus.create();
};

 module.exports = exports = OneWireService;
