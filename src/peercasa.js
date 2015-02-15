var util = require('util');
var Thing = require('./thing');
var S = require('string');
var io = require('socket.io-client');

function PeerCasa(_name, _displayName, _address, _casa, _owner, _proActiveMonitor, _props) {
   this.address = _address;
   this.casa = _casa;
   this.proActiveMonitor = _proActiveMonitor;

   this.connected = false;
   this.socket = null;
   
   Thing.call(this, 'peer-casa:' + _name, _displayName, _owner, _props);
   var that = this;

   var connectToPeerCasa = function() {
      console.log(that.name + ': Attempting to connect to peer casa ' + that.address.hostname + ':' + that.address.port);
      that.socket = io('http://' + that.address.hostname + ':' + that.address.port + '/');

      that.socket.on('connect', function() {
         console.log(that.name + ': Connected to my peer. Going active.');
         that.socket.emit('login', { name: that.casa.name });
         that.connected = true;
         that.emit('active', that.name);

         // listen for state changes from peer casas
         that.socket.on('state-active', function(data) {
            console.log(that.name + ': Event received from my peer. Event name: active, state: ' + data.stateName);
            that.emit('state-active', data.stateName);
         });

         that.socket.on('state-inactive', function(data) {
            console.log(that.name + ': Event received from my peer. Event name: active, instate: ' + data.stateName);
            that.emit('state-inactive', data.stateName);
         });
      });

      that.socket.on('error', function(error) {
         console.log(that.name + ': Error received: ' + error);
         console.log(that.name + ': Lost connection to my peer. Going inactive.');

         if (that.connected) {
            that.connected = false;
            that.emit('inactive', that.name);
         }
      });

      that.socket.on('event', function(data) {
         console.log(that.name + ': Event received: ' + data);
      });

      that.socket.on('disconnect', function() {
         console.log(that.name + ': Error disconnect');
         that.connected = false;
         console.log(that.name + ': Lost connection to my peer. Going inactive.');
         that.emit('inactive', that.name);
      });
   }

   if (this.proActiveMonitor) {
      // My role is to connect to my remote instance
      connectToPeerCasa();
   }
   else {
      // Listen to Casa for my remote instance to connect
      this.casa.on('casa-joined', function(name, socket) {
      
         if (name == S(that.name).strip('peer-')) {
           console.log(that.name + ': I am connected to my peer. Socket: ' + socket);

           if (that.connected == false) {
              that.connected = true;
              that.socket = socket;
              console.log(that.name + ': Connected to my peer. Going active.');
              that.emit('active', that.name);

              // listen for state changes from peer casas
              that.socket.on('state-active', function(data) {
                 console.log(that.name + ': Event received from my peer. Event name: active, instate: ' + data.stateName);
                 that.emit('state-active', data.stateName);
              });

              that.socket.on('state-inactive', function(data) {
                 console.log(that.name + ': Event received from my peer. Event name: inactive, instate: ' + data.stateName);
                 that.emit('state-inactive', data.stateName);
              });
           }
         }
      });

      this.casa.on('casa-lost', function(name) {

         if (name == S(that.name).strip('peer-')) {
           console.log(that.name + ': I have lost my peer!');

           if (that.connected == true) {
              that.connected = false;
              that.socket = null;
              console.log(that.name + ': Lost connection to my peer. Going inactive.');
              that.emit('inactive', that.name);
           }
         }
      });
   }

   // publish state chnages to peer casas
   this.casa.on('state-active', function(name) {
      console.log(that.name + ': if there is a socket I will publish state ' + name + ' active to peer casa');
      if (that.socket) {
         console.log(that.name + ': publishing state ' + name + ' active to peer casa');
         that.socket.emit('state-active', { stateName: name });
      }
   });

   this.casa.on('state-inactive', function(name) {
      console.log(that.name + ': if there is a socket I will publish state ' + name + ' inactive to peer casa');
      if (that.socket) {
         console.log(that.name + ': publishing state ' + name + ' inactive to peer casa');
         that.socket.emit('state-inactive', { stateName: name });
      }
   });
}

util.inherits(PeerCasa, Thing);

PeerCasa.prototype.getHostname = function() {
   return this.address.hostname;
};

PeerCasa.prototype.getPort = function() {
   return this.address.port;
};

module.exports = exports = PeerCasa;

