var util = require('util');
var Sonos = require('sonos');
var search = Sonos.search();
var SonosPlayer = require('./sonosplayer');

function SonosService() {
   this.uName = 'sonosservice:global';
   this.players = {};

   this.timeout = setTimeout(function() {
      console.log('No Zones Not found');
   }, 10000);

   var that = this;

   search.on('DeviceAvailable', function(_device, _model) {
     _device.getZoneAttrs(function(_err, _attrs) {
        clearTimeout(that.timeout);

        if (!that.players[_attrs.CurrentZoneName]) {
           that.players[_attrs.CurrentZoneName] = new SonosPlayer({ name: 'sonosplayer:' + _attrs.CurrentZoneName,
                                                                    displayName: _attrs.CurrentZoneName, host: _device.host,
                                                                    zone: _attrs.CurrentZoneName, model: _model });
           console.log(that.uName + ': Creating new Sonos Player for zone '+_attrs.CurrentZoneName+' at ' + _device.host + ', model:' + _model);
        }
        else {
           that.players[_attrs.CurrentZoneName].addDevice(_device.host, _model);
           console.log(that.uName + ': Adding host '+_device.host + ' to zone '+ _attrs.CurrentZoneName + ', model: ' + _model);
        }
     });
   });
}

module.exports = exports = SonosService;
