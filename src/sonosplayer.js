var util = require('util');
var Thing = require('./thing');
var Property = require('./property');
var Sonos = require('sonos');

function SonosPlayer(_config) {
   Thing.call(this, _config);

   this.zone = _config.zone;
   this.host = _config.host;
   this.sonos = new Sonos.Sonos(this.host);

   this.devices = {};
   this.devices[this.host] = _config.model;

   this.props['level']  = new Property({ name: 'level', type: 'property', initialValue: 0 }, this);
   this.props['playing']  = new Property({ name: 'playing', type: 'property', initialValue: false }, this);
   this.props['current-track']  = new Property({ name: 'current-track', type: 'property', initialValue: "" }, this);
}

util.inherits(SonosPlayer, Thing);

SonosPlayer.prototype.addDevice = function(_host, _model) {
   this.devices[_host] = _model;
}

SonosPlayer.prototype.coldStart = function() {
   Thing.prototype.coldStart.call(this);
};


SonosPlayer.prototype.play = function(_url) {

   this.sonos.play(_url, function(err, playing) {
      console.log([err, playing]);
   });
};

module.exports = exports = SonosPlayer;
