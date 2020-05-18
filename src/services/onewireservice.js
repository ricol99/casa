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

   this.oneWireBus.listAllSensors()
   .then( (_data) => {

      for (var i = 0; i < _data.ids.length; ++i) {
         var deviceType = _data.ids[i].split("-")[0];

         if (this.deviceTypes[deviceType]) {
            this.devices[_data.ids[i]] = this.createThing({ type: this.deviceTypes[deviceType], name: _data.ids[i] });
         }
         else {
            console.log(this.uName + ": Unknown Onewire device with type " + deviceType + " attached to pi, ignoring...");
         }
      }
   });
};

OneWireService.prototype.deviceConnected = function(_name, _callback) {

   if (this.devices[_name]) {
      this.oneWireBus.isConnected(_name)
      .then( (_connected) => {
         _callback(null, _connected);
      });
   }
   else {
      _callback("Device " + _name + " not found!");
   }
};

 module.exports = exports = OneWireService;
