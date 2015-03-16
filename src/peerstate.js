var util = require('util');
var events = require('events');
var S = require('string');

function PeerState(_name, _peerCasa) {
   this.name = _name;
   this.peerCasa = _peerCasa;

   events.EventEmitter.call(this);

   var that = this;

   this.peerCasa.addState(this);
}

util.inherits(PeerState, events.EventEmitter);

PeerState.prototype.stateHasGoneActive = function(_data) {
   console.log(this.name + ': received active event from peer. Going active!');
   this.emit('active', _data);
}

PeerState.prototype.stateHasGoneInactive = function(_data) {
   console.log(this.name + ': received inactive event from peer. Going inactive!');
   this.emit('inactive', _data);
}

PeerState.prototype.setActive = function(_callback) {
   console.log(this.name + ': Attempting to set state to active');
   this.peerCasa.setStateActive(this, _callback);
}

PeerState.prototype.setInactive = function(_callback) {
   console.log(this.name + ': Attempting to set state to inactive');
   this.peerCasa.setStateInactive(this, _callback);
}

PeerState.prototype.isActive = function(_callback) {
   console.log(this.name + ': Attempting to get state activity status');
   this.peerCasa.isStateActive(this, _callback);
}

PeerState.prototype.invalidateSource = function() {
   this.sourceEnabled = false;
   this.emit('invalid', { sourceName: this.name });
}

module.exports = exports = PeerState;

