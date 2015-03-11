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

   this.peerCasa.on('activator-active', function(_data) {
      if (_data.sourceName == that.name) {
         console.log(that.name + ': received active event from peer. Going active!');
         that.emit('active', _data);
      }
   });

   this.peerCasa.on('activator-inactive', function(_data) {
      if (_data.sourceName == that.name) {
         console.log(that.name + ': received inactive event from peer. Going inactive!');
         that.emit('inactive', _data);
      }
   });
}

util.inherits(PeerActivator, events.EventEmitter);

PeerActivator.prototype.invalidateSource = function() {
   this.emit('invalid');
}

module.exports = exports = PeerActivator;

