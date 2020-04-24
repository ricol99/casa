var util = require('util');
var SourceBase = require('./sourcebase');
var S = require('string');
var io = require('socket.io-client');
var Gang = require('./gang');

function RemoteCasa(_config, _peerCasa) {
   this.gang = Gang.mainInstance();
   this.casa = this.gang.casa;
   this.peerCasa = _peerCasa;

   SourceBase.call(this, _config.uName, this.gang);

   this.loginAs = 'remote';
   this.sources = [];
   this.workers = [];

   this.listenersSetUp = false;
   this.ensurePropertyExists('ACTIVE', 'property', { initialValue: false }, _config);

   // Listen to Casa for my remote instance to connect
   this.peerCasa.on('casa-active', (_data) => {

      if (!this.isActive()) {
         console.log(this.uName + ': Connected to my peer. Going active.');

         // listen for source changes from peer casas
         this.establishListeners(true);

         this.alignPropertyValue('ACTIVE', true, { sourceName: this.fullName });
      }
   });

   this.peerCasa.on('casa-inactive', (_data) => {

      if (this.isActive()) {
         console.log(this.uName + ': Lost connection to my peer. Going inactive.');
         this.alignPropertyValue('ACTIVE', false, { sourceName: this.fullName });
      }
   });
}

util.inherits(RemoteCasa, SourceBase);

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

RemoteCasa.prototype.setSourceProperty = function(_source, _property, _value, _callback) {
   peerCasa.setSourceProperty(_source, _property, _value, _callback);
}

RemoteCasa.prototype.setSourcePropertyWithRamp = function(_source, _property, _ramp, _callback) {
   peerCasa.setSourceProperty(_source, _property, _ramp, _callback);
}

RemoteCasa.prototype.addSource = function(_source) {
   // Peer source being added to remote casa
   console.log(this.uName + ': Source '  +_source.uName + ' added to remote casa ');
   this.sources[_source.uName] = _source;
   console.log(this.uName + ': ' + _source.uName + ' associated!');
}

RemoteCasa.prototype.invalidate = function() {

   for(var prop in this.sources) {

      if(this.sources.hasOwnProperty(prop)){
         console.log(this.uName + ': Invaliding source ' + this.sources[prop].uName);
         this.sources[prop].invalidate();
         delete this.sources[prop];
      }
   }

   delete this.sources;
   this.sources = [];
}

// Do nothing!
RemoteCasa.prototype.disconnectFromClient = function() {
};

module.exports = exports = RemoteCasa;

