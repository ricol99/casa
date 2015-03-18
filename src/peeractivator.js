var util = require('util');
var events = require('events');
var S = require('string');

function PeerActivator(_name, _peerCasa) {
   this.name = _name;
   this.peerCasa = _peerCasa;
   this.active = false;

   events.EventEmitter.call(this);

   var that = this;

   if (this.peerCasa) {
      this.peerCasa.addActivator(this);
   }
}

util.inherits(PeerActivator, events.EventEmitter);

PeerActivator.prototype.activatorHasGoneActive = function(_data) {
   console.log(this.name + ': received active event from peer. Going active!');
   this.active = true;
   this.emit('active', _data);
}

PeerActivator.prototype.activatorHasGoneInactive = function(_data) {
   console.log(this.name + ': received inactive event from peer. Going inactive!');
   this.active = false;
   this.emit('inactive', _data);
}

PeerActivator.prototype.isActive = function(_callback) {
   return this.active;
}

PeerActivator.prototype.invalidateSource = function() {
   this.sourceEnabled = false;
   this.emit('invalid', { sourceName: this.name });
}

module.exports = exports = PeerActivator;

