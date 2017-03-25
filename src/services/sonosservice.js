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
   var that = this;

   search.on('DeviceAvailable', function(_device, _model) {

     _device.getZoneAttrs(function(_err, _attrs) {

        if (!that.players.hasOwnProperty(_attrs.CurrentZoneName)) {
           that.players[_attrs.CurrentZoneName] = [ _device ];
           console.log(that.uName + ': Found new Sonos Player for zone '+_attrs.CurrentZoneName+' at ' + _device.host + ', model:' + _model);

           if (that.callbacks.hasOwnProperty(_attrs.CurrentZoneName)) {

              for (var i = 0; i < that.callbacks[_attrs.CurrentZoneName].length; ++i) {
                 that.callbacks[_attrs.CurrentZoneName][i](null, that.players[_attrs.CurrentZoneName][0]);
              }
           }
        }
        else {
           that.players[_attrs.CurrentZoneName].push(_device);

           if (that.callbacks.hasOwnProperty(_attrs.CurrentZoneName)) {

              for (var i = 0; i < that.callbacks[_attrs.CurrentZoneName].length; ++i) {
                 that.callbacks[_attrs.CurrentZoneName][i](null, that.players[_attrs.CurrentZoneName][that.players[_attrs.CurrentZoneName].length - 1]);
              }
           }
           console.log(that.uName + ': Adding host '+_device.host + ' to zone '+ _attrs.CurrentZoneName + ', model: ' + _model);
        }
     });
   });
};

SonosService.prototype.grabLocalListeningPort = function() {
   this.currentPort++;
   return this.currentPort - 1;
};

module.exports = exports = SonosService;
