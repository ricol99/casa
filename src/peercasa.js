var util = require('util');
var Thing = require('./thing');
var S = require('string');
var io = require('socket.io-client');

// TBD Need to add event send failure queue
function PeerCasa(_name, _displayName, _address, _casa, _casaArea, _proActiveConnect, _props) {

   this.address = null;
   this.casa = null;
   this.proActiveConnect = false;

   if (_name.name) {
      // constructing from object rather than params
      this.address = _name.address;
      this.casa = _name.casa;
      this.proActiveConnect = _name.proActiveConnect;
      Thing.call(this, _name.name, _name.displayName, _name.casaArea, _name.props);
   }
   else {
      this.address = _address;
      this.casa = _casa;
      this.proActiveConnect = _proActiveConnect;
      Thing.call(this, _name, _displayName, _casaArea, _props);
   }

   this.connected = false;
   this.socket = null;
   this.intervalID = null;
   this.unAckedMessages = [];
   
   var that = this;

   if (this.proActiveConnect) {
      // My role is to connect to my remote instance
      this.connectToPeerCasa();
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

              // listen for state changes from peer casas
              that.establishListeners();

              if (that.unAckedMessages.length > 1) {
                  resendUnAckedMessages();
               }

              that.emit('active', that.name);

           }
         }
      });

      this.casa.on('casa-lost', function(name) {

         if (name == S(that.name).strip('peer-')) {
           console.log(that.name + ': I have lost my peer!');

           if (that.connected == true) {
              that.connected = false;
              clearInterval(that.intervalID);
              that.socket = null;
              console.log(that.name + ': Lost connection to my peer. Going inactive.');
              that.emit('inactive', that.name);
           }
         }
      });
   }

   // publish state changes to remote casas
   this.casa.on('state-active', function(name) {
      console.log(that.name + ': if there is a socket I will publish state ' + name + ' active to peer casa');
      if (that.socket) {
         console.log(that.name + ': publishing state ' + name + ' active to peer casa');
         that.unAckedMessages.push( { message: 'state-active', data: { stateName: name } } );
         that.socket.emit('state-active', { stateName: name });
      }
   });

   this.casa.on('state-inactive', function(name) {
      console.log(that.name + ': if there is a socket I will publish state ' + name + ' inactive to peer casa');
      if (that.socket) {
         console.log(that.name + ': publishing state ' + name + ' inactive to peer casa');
         that.unAckedMessages.push( { message: 'instate-active', data: { stateName: name } } );
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

PeerCasa.prototype.connectToPeerCasa = function() {
   var that = this;

   console.log(this.name + ': Attempting to connect to peer casa ' + this.address.hostname + ':' + this.address.port);
   this.socket = io('http://' + that.address.hostname + ':' + this.address.port + '/');

   this.socket.on('connect', function() {
      console.log(that.name + ': Connected to my peer. Going active.');
      that.establishListeners();
      that.unAckedMessages.push( { message: 'login', data: { name: that.casa.name } } );
      that.socket.emit('login', { name: that.casa.name });
   });

   this.socket.on('loginAACCKK', function(data) {
      console.log(that.name + ': Login Event ACKed by my peer.');

      that.unAckedMessages.pop();  // Remove Login

      if (that.unAckedMessages.length > 1) {
         resendUnAckedMessages();
      }
      
      that.connected = true;
      that.emit('active', that.name);
   });

   this.socket.on('error', function(error) {
      console.log(that.name + ': Error received: ' + error);
      console.log(that.name + ': Lost connection to my peer. Going inactive.');

      if (that.connected) {
         that.connected = false;
         clearInterval(that.intervalID);
         that.emit('inactive', that.name);
      }
   });

   this.socket.on('event', function(data) {
      console.log(that.name + ': Event received: ' + data);
   });

   this.socket.on('disconnect', function() {
      console.log(that.name + ': Error disconnect');
      that.connected = false;
      clearInterval(that.intervalID);
      console.log(that.name + ': Lost connection to my peer. Going inactive.');
      that.emit('inactive', that.name);
   });
}

PeerCasa.prototype.establishListeners = function() {
   var that = this;

   // listen for state changes from peer casas
   this.socket.on('state-active', function(data) {
      console.log(that.name + ': Event received from my peer. Event name: active, state: ' + data.stateName);
      that.emit('state-active', data.stateName);
      that.socket.emit('state-activeAACCKK');
   });

   this.socket.on('state-inactive', function(data) {
      console.log(that.name + ': Event received from my peer. Event name: active, instate: ' + data.stateName);
      that.emit('state-inactive', data.stateName);
      that.socket.emit('state-inactiveAACCKK');
   });

   this.socket.on('state-activeAACCKK', function(data) {
      console.log(that.name + ': Active Event ACKed by my peer.');
      that.unAckedMessages.shift();
   });

   this.socket.on('state-inactiveAACCKK', function(data) {
      console.log(that.name + ': Inactive Event ACKed by my peer.');
      that.unAckedMessages.shift();
   });

   // Establish heartbeat
   this.intervalID = setInterval(function(){
      that.socket.emit('heartbeat', { name: that.casa.name });
   }, 60000);
}

PeerCasa.prototype.resendUnAckedMessages = function() {
   var that = this;

   this.unAckedMessages.forEach(function(message) {
      that.socket.emit(message.message, message.data);
   });

}

PeerCasa.prototype.addState = function(_state) {
   console.log(this.name + ': State '  +_state.name + ' added to casa ');
   this.states[_state.name] = _state;
   var that = this;

   _state.on('active', function (sourceName) {
      console.log(this.name + ': ' + sourceName + ' has become active');
      //that.emit('state-active', sourceName);
   });

   _state.on('inactive', function (sourceName) {
      console.log(this.name + ': ' + sourceName + ' has become inactive');
      //that.emit('state-inactive', sourceName);
   });

   console.log(this.name + ': ' + _state.name + ' associated!');
}

module.exports = exports = PeerCasa;

