var util = require('util');
var events = require('events');
var S = require('string');
var io = require('socket.io-client');
var CasaSystem = require('./casasystem');

function RemoteCasa(_config, _peerCasa) {
   this.name = _config.name;
   this.casaSys = CasaSystem.mainInstance();
   this.casa = this.casaSys.casa;
   this.peerCasa = _peerCasa;

   events.EventEmitter.call(this);

   this.loginAs = 'remote';
   this.sources = [];
   this.workers = [];

   this.listenersSetUp = false;
   this.active = false;

   var that = this;

   // Listen to Casa for my remote instance to connect
   this.peerCasa.on('casa-active', function(_data) {

      if (!that.active) {
         that.active = true;
         console.log(that.name + ': Connected to my peer. Going active.');

         // listen for source changes from peer casas
         that.establishListeners(true);
         that.emit('active', { sourceName: that.name });
      }
   });

   this.peerCasa.on('casa-inactive', function(_data) {

      if (that.active) {
         console.log(that.name + ': Lost connection to my peer. Going inactive.');
         that.active = false;
         that.emit('inactive', { sourceName: that.name });
      }
   });
}

util.inherits(RemoteCasa, events.EventEmitter);

RemoteCasa.prototype.establishListeners = function(_force) {

   if (!this.listenersSetUp || _force) {
      var that = this;

      // listen for sourcechanges from peer casas
      this.peerCasa.on('source-active', function(_data) {
         console.log(that.name + ': Event received from remote casa. Event name: active, source: ' + _data.sourceName);

         if (that.sources[_data.sourceName]) {
            that.sources[_data.sourceName].sourceHasGoneActive(_data);
         }
         that.emit('source-active', _data);
      });

      this.peerCasa.on('source-inactive', function(_data) {
         console.log(that.name + ': Event received from my peer. Event name: inactive, source: ' + _data.sourceName);

         if (that.sources[_data.sourceName]) {
            that.sources[_data.sourceName].sourceHasGoneInactive(_data);
         }
         that.emit('source-inactive', _data);
      });

      this.listenersSetUp = true;
   }
}

RemoteCasa.prototype.setSourceActive = function(_source, _callback) {
   peerCasa.setSourceActive(_source, _callback);
}

RemoteCasa.prototype.setSourceInactive = function(_source, _callback) {
   peerCasa.setSourceInactive(_source, _callback);
}

RemoteCasa.prototype.addSource = function(_source) {
   // Peer source being added to remote casa
   console.log(this.name + ': Source '  +_source.name + ' added to remote casa ');
   this.sources[_source.name] = _source;
   console.log(this.name + ': ' + _source.name + ' associated!');
}

RemoteCasa.prototype.invalidateSources = function() {

   for(var prop in this.sources) {

      if(this.sources.hasOwnProperty(prop)){
         console.log(this.name + ': Invaliding source ' + this.sources[prop].name);
         this.sources[prop].invalidateSource();
         delete this.casaSys.allObjects[this.sources[prop].name];
         delete this.sources[prop];
      }
   }

   delete this.sources;
   this.sources = [];
}

module.exports = exports = RemoteCasa;

