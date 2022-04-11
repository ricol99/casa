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

// Called when current state required
SonosServiceZone.prototype.export = function(_exportObj) {
   Thing.prototype.export.call(this, _exportObj);
};

// Called when current state required
SonosServiceZone.prototype.import = function(_importObj) {
   Thing.prototype.import.call(this, _importObj);
};

SonosServiceZone.prototype.coldStart = function() {
   Thing.prototype.coldStart.call(this);
};

SonosServiceZone.prototype.hotStart = function() {
   Thing.prototype.hotStart.call(this);
};

module.exports = exports = SonosServiceZone;

