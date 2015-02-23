var util = require('util');
var events = require('events');
var S = require('string');

function PeerActivator(_name, _peerCasa) {
   this.name = _name;
   this.peerCasa = _peerCasa;

   events.EventEmitter.call(this);

   var that = this;

   if (this.peerCasa) {
      this.peerCasa.addActivator(this);
   }

   this.peerCasa.on('activator-active', function(_name) {
      console.log(that.name + ': checking activator-active event ' + _name + ' received from remote.');
      if (_name == that.name) {
         console.log(that.name + ': received active event from peer. Going active!');
         that.emit('active', _name);
      }
   });

   this.peerCasa.on('activator-inactive', function(_name) {
      console.log(that.name + ': checking activator-inactive event ' + _name + ' received from remote.');
      if (_name == that.name) {
         console.log(that.name + ': received inactive event from peer. Going inactive!');
         that.emit('inactive', _name);
      }
   });
}

util.inherits(PeerActivator, events.EventEmitter);

module.exports = exports = PeerActivator;

