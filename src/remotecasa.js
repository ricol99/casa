var util = require('util');
var Thing = require('./thing');
var S = require('string');
var io = require('socket.io-client');
var CasaSystem = require('./casasystem');

function RemoteCasa(_config) {
   var casaSys = CasaSystem.mainInstance();
   this.casa = casaSys.casa;

   Thing.call(this, _config);

   this.states = [];
   this.activators = [];
   this.actions = [];

   this.listenersSetUp = false;
   this.active = false;

   var that = this;

   // Listen to Casa for my remote instance to connect
   this.session.on('casa-joined', function(_data) {
      
      if (_data.peerName == that.name) {
        console.log(that.name + ': I am connected to my peer.');

        if (!that.active) {
           that.active = true;
           console.log(that.name + ': Connected to my peer. Going active.');

           // listen for state and activator changes from peer casas
           that.establishListeners(true);
           that.emit('active', { sourceName: that.name });
        }
      }
   });

   this.session.on('casa-lost', function(_data) {

      if (_data.peerName == that.name) {
         console.log(that.name + ': I have lost my peer!');

         if (that.active) {
            console.log(that.name + ': Lost connection to my peer. Going inactive.');
            that.active = false;
            that.emit('inactive', { sourceName: that.name });
         }
      }
   });
}

util.inherits(RemoteCasa, Thing);

RemoteCasa.prototype.establishListeners = function(_force) {

   if (!this.listenersSetUp || _force) {
      var that = this;

      // listen for state changes from peer casas
      this.session.on('state-active', function(_data) {
         console.log(that.name + ': Event received from remote casa. Event name: active, state: ' + _data.sourceName);
         that.emit('state-active', _data);
      });

      this.session.on('state-inactive', function(_data) {
         console.log(that.name + ': Event received from my peer. Event name: inactive, state: ' + _data.sourceName);
         that.emit('state-inactive', _data);
      });

      // listen for activator changes from peer casas
      this.session.on('activator-active', function(_data) {
         console.log(that.name + ': Event received from my peer. Event name: active, activator: ' + _data.sourceName);
         that.emit('activator-active', _data);
      });

      this.session.on('activator-inactive', function(_data) {
         console.log(that.name + ': Event received from my peer. Event name: inactive, activator: ' + _data.sourceName);
         that.emit('activator-inactive', _data);
      });

      this.listenersSetUp = true;
   }
}

RemoteCasa.prototype.addState = function(_state) {
   // Peer state being added to remote casa
   console.log(this.name + ': State '  +_state.name + ' added to remote casa ');
   this.states[_state.name] = _state;
   console.log(this.name + ': ' + _state.name + ' associated!');
}

RemoteCasa.prototype.setStateActive = function(_state, _callback) {
   session.setStateActive(_state, _callback);
}

RemoteCasa.prototype.setStateInactive = function(_state, _callback) {
   session.setStateInactive(_state, _callback);
}

RemoteCasa.prototype.isStateActive = function(_state, _callback) {
   session.isStateActive(_state, _callback);
}

RemoteCasa.prototype.addActivator = function(_activator) {
   // Peer acivator being added to peer casa
   console.log(this.name + ': Activator '  +_activator.name + ' added to remote casa ');
   this.activators[_activator.name] = _activator;
   console.log(this.name + ': ' + _activator.name + ' associated!');
}

module.exports = exports = RemoteCasa;

