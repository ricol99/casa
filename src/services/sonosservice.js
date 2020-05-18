var util = require('util');
var Service = require('../service');
var Sonos = require('sonos');
var search = Sonos.DeviceDiscovery();
const url = require('url');

const listener = require('sonos').Listener;

// Just keep listening until CTRL + C is pressed
process.on('SIGINT', () => {
  console.log('Hold-on cancelling all subscriptions')
  listener.stopListener().then(result => {
    console.log('Cancelled all subscriptions')
    process.exit()
  }).catch(err => {
    console.log('Error cancelling subscriptions, exit in 3 seconds  %s', err)
    setTimeout(() => {
      process.exit(1)
    }, 2500)
  })
});

function SonosService(_config, _owner) {
   Service.call(this, _config, _owner);
   this.devices = {};
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

      _device.getZoneAttrs().then(_attrs => {

         if (this.devices[_device.host]) {

            if (this.devices[_device.host]._currentZoneName === _attrs.CurrentZoneName) {
               // Known device
               return;
            }
            else {
               // Known device has changed zones *** TDB ** - DO something!
               _device._oldZoneName = this.devices[_device.host]._currentZoneName;
               _device._currentZoneName = _attrs.CurrentZoneName;
               return;
            }
         }
         else {
            this.devices[_device.host] = _device;
            _device._currentZoneName = _attrs.CurrentZoneName;
         }

         if (!this.players.hasOwnProperty(_attrs.CurrentZoneName)) {
            this.players[_attrs.CurrentZoneName] = [ _device ];
            console.log(this.uName + ': Found new Sonos Player for zone '+_attrs.CurrentZoneName+' at ' + _device.host + ', model:' + _model);
         }
         else {
            this.players[_attrs.CurrentZoneName].push(_device);
            console.log(this.uName + ': Adding host '+_device.host + ' to zone '+ _attrs.CurrentZoneName + ', model: ' + _model);
         }

         _device.getTopology().then(_topology => {

            for (let i = 0; i < _topology.zones.length; ++i) {
               var u = url.parse(_topology.zones[i].location);

               if ((_device.host === u.hostname) && (_topology.zones[i].coordinator === 'true')) {
                  console.log(this.uName + ': Found controlling Sonos Player for zone '+_device._currentZoneName+' at ' + _device.host);

                  if (_device._oldZoneName) {

                     if (this.devices[_device.host]._controller) {

                        for (var k = 0; k < this.callbacks[_device._oldZoneName].length; ++j) {
                           this.callbacks[_device._oldZoneName][k]("Device has changed zone");
                        }
                     }
                     _device._oldZoneName = null;
                     delete _device._oldZoneName;
                     this.devices[_device.host] = _device;
                  }

                  _device._controller = true;

                  if (this.callbacks.hasOwnProperty(_device._currentZoneName)) {

                     for (var j = 0; j < this.callbacks[_device._currentZoneName].length; ++j) {
                        this.callbacks[_device._currentZoneName][j](null, _device);
                     }
                  }
               }
            }
         }).catch(console.error);
      }).catch(console.error);
   });
};

SonosService.prototype.grabLocalListeningPort = function() {
   this.currentPort++;
   return this.currentPort - 1;
};

module.exports = exports = SonosService;
