var util = require('util');
var Thing = require('../../thing');
const { Sonos } = require('sonos');

function SonosServiceZone(_config, _owner) {
   Thing.call(this, _config, _owner);
   console.log(this.uName + ": New sonos zone created");
   this.zone = _config.zone;
   this.host = _config.host;
   this.port = _config.port;
   this.devices = [];

   this.ensurePropertyExists('zone', 'property', { initialValue: this.zone }, _config);
   this.ensurePropertyExists('host', 'property', { initialValue: this.host }, _config);
   this.ensurePropertyExists('port', 'property', { initialValue: this.port }, _config);
}

util.inherits(SonosServiceZone, Thing);

module.exports = exports = SonosServiceZone;

