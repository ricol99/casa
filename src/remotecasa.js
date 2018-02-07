var util = require('util');
var Source = require('./source');
var S = require('string');
var io = require('socket.io-client');
var CasaSystem = require('./casasystem');

function RemoteCasa(_config, _peerCasa) {
   this.casaSys = CasaSystem.mainInstance();
   this.casa = this.casaSys.casa;
   this.peerCasa = _peerCasa;

   Source.call(this, _config);

   this.loginAs = 'remote';
   this.sources = [];
   this.workers = [];

   this.listenersSetUp = false;

   // Listen to Casa for my remote instance to connect
   this.peerCasa.on('casa-active', (_data) => {

      if (!this.isActive()) {
         console.log(this.uName + ': Connected to my peer. Going active.');

         // listen for source changes from peer casas
         this.establishListeners(true);

         this.alignPropertyValue('ACTIVE', true, { sourceName: this.uName });
      }
   });

   this.peerCasa.on('casa-inactive', (_data) => {

      if (this.isActive()) {
         console.log(this.uName + ': Lost connection to my peer. Going inactive.');
         this.alignPropertyValue('ACTIVE', false, { sourceName: this.uName });
      }
   });
}

util.inherits(RemoteCasa, Source);

RemoteCasa.prototype.establishListeners = function(_force) {

   if (!this.listenersSetUp || _force) {

      // listen for sourcechanges from peer casas
      this.peerCasa.on('source-property-changed', (_data) => {
         console.log(this.uName + ': Event received from remote casa. Event name: property-changed, source: ' + _data.sourceName);

         if (this.sources[_data.sourceName]) {
            this.sources[_data.sourceName].sourceHasChangedProperty(_data);
         }
         this.emit('source-property-changed', _data);
      });

      this.peerCasa.on('source-event-raised', (_data) => {
         console.log(this.uName + ': Event received from remote casa. Event name: event-raised, source: ' + _data.sourceName);

         if (this.sources[_data.sourceName]) {
            this.sources[_data.sourceName].sourceHasRaisedEvent(_data);
         }
         this.emit('source-event-raised', _data);
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
   console.log(this.uName + ': Source '  +_source.name + ' added to remote casa ');
   this.sources[_source.uName] = _source;
   console.log(this.uName + ': ' + _source.uName + ' associated!');
}

RemoteCasa.prototype.invalidateSources = function() {

   for(var prop in this.sources) {

      if(this.sources.hasOwnProperty(prop)){
         console.log(this.uName + ': Invaliding source ' + this.sources[prop].uName);
         this.sources[prop].invalidateSource();
         delete this.casaSys.allObjects[this.sources[prop].uName];
         delete this.sources[prop];
      }
   }

   delete this.sources;
   this.sources = [];
}

module.exports = exports = RemoteCasa;

