var util = require('util');
var Service = require('./service');
var Sonos = require('sonos');
var search = Sonos.search();

function SonosService(_config) {
   Service.call(this, _config);
   this.players = {};
   this.callbacks = {};
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
      _callback(null, this.players[_zone].devices[0].host);
   }
};

SonosService.prototype.coldStart = function() {
   var that = this;

   search.on('DeviceAvailable', function(_device, _model) {

     _device.getZoneAttrs(function(_err, _attrs) {

        if (!that.players[_attrs.CurrentZoneName]) {
           that.players[_attrs.CurrentZoneName] = { zone: _attrs.CurrentZoneName, devices: [{ host: _device.host, model: _model }] };
           console.log(that.uName + ': Found new Sonos Player for zone '+_attrs.CurrentZoneName+' at ' + _device.host + ', model:' + _model);

           if (that.callbacks[_attrs.CurrentZoneName]) {

              for (var i = 0; i < that.callbacks[_attrs.CurrentZoneName].length; ++i) {
                 that.callbacks[_attrs.CurrentZoneName][i](null, that.players[_attrs.CurrentZoneName].devices[0].host);
              }
           }
        }
        else {
           that.players[_attrs.CurrentZoneName].devices.push({ host: _device.host, model: _model });
           console.log(that.uName + ': Adding host '+_device.host + ' to zone '+ _attrs.CurrentZoneName + ', model: ' + _model);
        }
     });
   });
};

module.exports = exports = SonosService;
