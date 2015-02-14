var util = require('util');
var limb = require('limb');
var State = require('./state');
var io = require('socket.io-client')

function PeerCasaState(_name, _peerCasa, _proActiveMonitor) {
   this.peerCasa = _peerCasa;
   this.proActiveMonitor = _proActiveMonitor;
   this.active = false;
   this.coldStart = true;
   this.socket = null;

   State.call(this, 'peer-casa:' + _name, _peerCasa);

   var that = this;

   limb.info = {
      name: this.peerCasa.casa.name
   };

   this.peerCasa.on('casa-joined', function(name) {
     console.log(that.name + ': I am connected to my peer!');
     that.active = true;
     that.coldStart = false;
     console.log(that.name + ': Connected to '+ that.peerCasa.name + '. Going active.');
     that.emit('active', that.name);
   });

   this.peerCasa.on('casa-lost', function(name) {
      console.log(that.name + ': I have lost my peer!');
      if (that.active || that.coldStart) {
         that.coldStart = false;
         that.active = false;
         console.log(that.name + ': Lost connection to ' + that.peerCasa.name + '. Going inactive.');
         that.emit('inactive', that.name);
      }
   });

   var connectToPeerCasaIO = function() {
      console.log(that.name + ': Attempting to connect to peer casa ' + that.peerCasa.getHostname() + ':' + that.peerCasa.getPort());
      that.socket = io('http://' + that.peerCasa.getHostname() + ':' + that.peerCasa.getPort() + '/');

      that.socket.on('connect', function() {
         console.log(that.name + ': Connected to '+ that.peerCasa.name + '. Going active.');
         that.socket.emit('login', { name: that.peerCasa.casa.name });
         that.active = true;
         that.coldStart = false;
         that.emit('active', that.name);
      });

      that.socket.on('error', function(error) {
         console.log(that.name + ': Error received: ' + error);
         if (that.active || that.coldStart) {
            that.coldStart = false;
            that.active = false;
            console.log(that.name + ': Lost connection to ' + that.peerCasa.name + '. Going inactive.');
            that.emit('inactive', that.name);
         }
      });

      that.socket.on('event', function(data) {
         console.log(that.name + ': Event received: ' + data);
      });

      that.socket.on('disconnect', function() {
         console.log(that.name + ': Error disconnect');
         that.coldStart = false;
         that.active = false;
         console.log(that.name + ': Lost connection to ' + that.peerCasa.name + '. Going inactive.');
         that.emit('inactive', that.name);
      });
   }

   var connectToPeerCasa = function() {
      console.log(that.name + ': Attempting to connect to peer casa ' + that.peerCasa.getHostname() + ':' + that.peerCasa.getPort());
      limb.connect(that.peerCasa.getPort(), that.peerCasa.getHostname(), function(crap) {
         if (crap == 0) {
            that.active = true;
            that.coldStart = false;
            console.log(that.name + ': Connected to '+ that.peerCasa.name + '. Going active.');
            that.emit('active', that.name);
         }
         else {
            if (that.active || that.coldStart) {
               that.coldStart = false;
               that.active = false;
               console.log(that.name + ': Lost connection to ' + that.peerCasa.name + '. Going inactive.');
               that.emit('inactive', that.name);
            }
            setTimeout(connectToPeerCasa, 10*1000);
         }
      });
   };

   if (this.proActiveMonitor) {
      //connectToPeerCasa();
      connectToPeerCasaIO();
   }
}

util.inherits(PeerCasaState, State);

module.exports = exports = PeerCasaState;
 
