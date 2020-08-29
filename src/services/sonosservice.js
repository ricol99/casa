var util = require('util');
const { DeviceDiscovery } = require('sonos')
const { Sonos } = require('sonos')
var Service = require('../service');

function SonosService(_config, _owner) {
   Service.call(this, _config, _owner);

   this.groups = {};
   this.zones = {};
   this.devices = {};
};
 
util.inherits(SonosService, Service);

SonosService.prototype.coldStart = function() {

   try {
      DeviceDiscovery((_device) => {

         if (!this.devices.hasOwnProperty(_device.host+":"+_device.port)) {
            console.log('found device at ' + _device.host);
            this.devices[_device.host+":"+_device.port] = util.copy(_device, true);
         }

         // get all groups
         var sonos = new Sonos(_device.host)

         sonos.getAllGroups().then(_groups => {

            for (var i = 0; i < _groups.length; ++i) {

               if (!this.groups.hasOwnProperty(_groups[i].Name)) {
                  console.log(this.uName + ": Found new group " + _groups[i].Name + "    " + _groups[i].host + ":" + _groups[i].port);
                  this.groups[_groups[i].Name] = util.copy(_groups[i], true);

                  if (!this.zones.hasOwnProperty(_groups[i].ZoneGroupMember[0].ZoneName)) {
                     console.log(this.uName + ": Found new zone " + _groups[i].ZoneGroupMember[0].ZoneName);
                     this.zones[_groups[i].ZoneGroupMember[0].ZoneName] = { id: _groups[i].ID, host: _groups[i].host, port: _groups[i].port };

                     var thing = this.createThing({ type: "sonosservicezone", name: _groups[i].ZoneGroupMember[0].ZoneName.replace(/ /g, '-'),
                                                    zone: _groups[i].ZoneGroupMember[0].ZoneName,
                                                    host: _groups[i].host, port: _groups[i].port });

                     this.zones[_groups[i].ZoneGroupMember[0].ZoneName].coordinator = thing;
                  }
               }
            }
         });
      });
   }
   catch (_error) {
      console.error(this.uName + ": Error " + _error + " received during device discovery");
   }
};

module.exports = exports = SonosService;
