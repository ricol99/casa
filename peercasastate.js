var util = require('util');
var limb = require('limb');
var State = require('./state');

function PeerCasaState(_name, _peerCasa) {
   this.peerCasa = _peerCasa;

   this.active = false;
   this.coldStart = true;

   State.call(this, 'peerCasa:' + _name, _peerCasa);

   var that = this;

   limb.info = {
      name: this.name
   };

   var connectToPeerCasa = function() {
      console.log(that.name + ': Attempting to connect to peerCasa ' + that.peerCasa.getHostname() + ':' + that.peerCasa.getPort());
      limb.connect(that.peerCasa.getPort(), that.peerCasa.getHostname(), function(crap) {
         if (crap == 0) {
            that.active = true;
            that.coldStart = false;
            that.emit('active', that.name);
            console.log(that.name + ': Connected to peerCasa. PeerCasaState going active.');
         }
         else {
            if (that.active || that.coldStart) {
               that.coldStart = false;
               that.active = false;
               that.emit('inactive', that.name);
               console.log(that.name + ': Lost connection to peerCasa. PeerCasaState going inactive.');
            }
            setTimeout(connectToPeerCasa, 10*1000);
         }
      });
   };

   connectToPeerCasa();
}

util.inherits(PeerCasaState, State);

module.exports = exports = PeerCasaState;
 
