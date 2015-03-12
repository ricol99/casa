var util = require('util');
var Thing = require('./thing');
var S = require('string');
var io = require('socket.io-client');
var CasaSystem = require('./casasystem');

function RemoteCasa(_config, _peerCasa) {
   this.casaSys = CasaSystem.mainInstance();
   this.casa = this.casaSys.casa;
   this.peerCasa = _peerCasa;

   Thing.call(this, _config);

   this.states = [];
   this.activators = [];
   this.actions = [];

   this.listenersSetUp = false;
   this.active = false;

   var that = this;

   // Listen to Casa for my remote instance to connect
   this.peerCasa.on('casa-active', function(_data) {
     that.active = true;
     console.log(that.name + ': Connected to my peer. Going active.');

     // listen for state and activator changes from peer casas
     that.establishListeners(true);
     that.emit('active', { sourceName: that.name });
   });

   this.peerCasa.on('casa-inactive', function(_data) {

      if (that.active) {
         console.log(that.name + ': Lost connection to my peer. Going inactive.');
         that.active = false;
         that.emit('inactive', { sourceName: that.name });
      }
   });
}

util.inherits(RemoteCasa, Thing);

RemoteCasa.prototype.establishListeners = function(_force) {

   if (!this.listenersSetUp || _force) {
      var that = this;

      // listen for state changes from peer casas
      this.peerCasa.on('state-active', function(_data) {
         console.log(that.name + ': Event received from remote casa. Event name: active, state: ' + _data.sourceName);
         that.emit('state-active', _data);
      });

      this.peerCasa.on('state-inactive', function(_data) {
         console.log(that.name + ': Event received from my peer. Event name: inactive, state: ' + _data.sourceName);
         that.emit('state-inactive', _data);
      });

      // listen for activator changes from peer casas
      this.peerCasa.on('activator-active', function(_data) {
         console.log(that.name + ': Event received from my peer. Event name: active, activator: ' + _data.sourceName);
         that.emit('activator-active', _data);
      });

      this.peerCasa.on('activator-inactive', function(_data) {
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
   peerCasa.setStateActive(_state, _callback);
}

RemoteCasa.prototype.setStateInactive = function(_state, _callback) {
   peerCasa.setStateInactive(_state, _callback);
}

RemoteCasa.prototype.isStateActive = function(_state, _callback) {
   peerCasa.isStateActive(_state, _callback);
}

RemoteCasa.prototype.addActivator = function(_activator) {
   // Peer acivator being added to peer casa
   console.log(this.name + ': Activator '  +_activator.name + ' added to remote casa ');
   this.activators[_activator.name] = _activator;
   console.log(this.name + ': ' + _activator.name + ' associated!');
}

RemoteCasa.prototype.invalidateSources = function() {

   for(var prop in this.states) {

      if(this.states.hasOwnProperty(prop)){
         console.log(this.name + ': Invaliding state ' + this.states[prop].name);
         this.states[prop].invalidateSource();
         this.casaSys.allObjects[this.states[prop].name] = null;
         delete this.states[prop];
      }
   }

   for(var prop in this.activators) {

      if(this.activators.hasOwnProperty(prop)){
         console.log(this.name + ': Invaliding activator ' + this.activators[prop].name);
         this.activators[prop].invalidateSource();
         this.casaSys.allObjects[this.activators[prop].name] = null;
         delete this.activators[prop];
      }
   }

   delete this.states;
   delete this.activators;
   this.states = [];
   this.activators = [];
}

module.exports = exports = RemoteCasa;

