var util = require('util');
var events = require('events');
var S = require('string');

function PeerState(_name, _peerCasa) {
   this.name = _name;
   this.peerCasa = _peerCasa;

   events.EventEmitter.call(this);

   var that = this;

   if (this.peerCasa) {
      this.peerCasa.addState(this);
   }

   this.peerCasa.on('state-active', function(_data) {
      if (_data.sourceName == that.name) {
         console.log(that.name + ': received active event from peer. Going active!');
         that.emit('active', _data);
      }
   });

   this.peerCasa.on('state-inactive', function(_data) {
      if (_data.sourceName == that.name) {
         console.log(that.name + ': received inactive event from peer. Going inactive!');
         that.emit('inactive', _data);
      }
   });
}

util.inherits(PeerState, events.EventEmitter);

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

module.exports = exports = PeerState;

