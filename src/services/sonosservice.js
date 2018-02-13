var util = require('util');
var Service = require('../service');
var Sonos = require('sonos');
var search = Sonos.search();

function SonosService(_config) {
   Service.call(this, _config);
   this.players = {};
   this.callbacks = {};
   this.portStart = _config.hasOwnProperty("portStart") ? _config.portStart : 12000;
   this.currentPort = this.portStart;
}

util.inherits(SonosService, Service);

SonosService.prototype.registerForHostForZone = function(_zone, _callback) {

   if (this.callbacks[_zone]) {
      this.callbacks[_zone].push(_callback);
   }
   else {
      this.callbacks[_zone] = [ _callback ];
   }

   if (this.players[_zone]) {
      _callback(null, this.players[_zone][0]);
   }
};

SonosService.prototype.coldStart = function() {
   search.setMaxListeners(50);

   search.on('DeviceAvailable', (_device, _model) => {

     _device.getZoneAttrs( (_err, _attrs) => {

        if (!this.players.hasOwnProperty(_attrs.CurrentZoneName)) {
           this.players[_attrs.CurrentZoneName] = [ _device ];
           console.log(this.uName + ': Found new Sonos Player for zone '+_attrs.CurrentZoneName+' at ' + _device.host + ', model:' + _model);

           if (this.callbacks.hasOwnProperty(_attrs.CurrentZoneName)) {

              for (var i = 0; i < this.callbacks[_attrs.CurrentZoneName].length; ++i) {
                 this.callbacks[_attrs.CurrentZoneName][i](null, this.players[_attrs.CurrentZoneName][0]);
              }
           }
        }
        else {
           this.players[_attrs.CurrentZoneName].push(_device);

           if (this.callbacks.hasOwnProperty(_attrs.CurrentZoneName)) {

              for (var i = 0; i < this.callbacks[_attrs.CurrentZoneName].length; ++i) {
                 this.callbacks[_attrs.CurrentZoneName][i](null, this.players[_attrs.CurrentZoneName][this.players[_attrs.CurrentZoneName].length - 1]);
              }
           }
           console.log(this.uName + ': Adding host '+_device.host + ' to zone '+ _attrs.CurrentZoneName + ', model: ' + _model);
        }
     });
   });
};

SonosService.prototype.grabLocalListeningPort = function() {
   this.currentPort++;
   return this.currentPort - 1;
};

module.exports = exports = SonosService;
