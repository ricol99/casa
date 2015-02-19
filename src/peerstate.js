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

   this.peerCasa.on('state-active', function(name) {
      if (name == S(that.name).strip('peer-')) {
         console.log(that.name + ': received active event from peer. Going active!');
         that.emit('active', name);
      }
   });

   this.peerCasa.on('state-inactive', function(name) {
      if (name == S(that.name).strip('peer-')) {
         console.log(that.name + ': received inactive event from peer. Going inactive!');
         that.emit('inactive', name);
      }
   });
}

util.inherits(PeerState, events.EventEmitter);

module.exports = exports = PeerState;

