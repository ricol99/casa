var util = require('util');
//var events = require('events');
var Source = require('./source');
var S = require('string');
var io = require('socket.io-client');
var CasaSystem = require('./casasystem');

function PeerCasa(_config) {
   this.name = _config.name;
   this.casaSys = CasaSystem.mainInstance();
   this.casa = this.casaSys.casa;
   this.config = _config;
   
   this.proActiveConnect = _config.proActiveConnect;
   this.address = _config.address;

   this.casaArea = null;
   this.loginAs = 'peer';
   this.remoteCasas = [];
   this.persistent = false;
   this.deathTime = 60;

   Source.call(this, _config);

   this.sources = [];
   this.workers = [];

   this.listenersSetUp = false;
   this.casaListeners = [];

   this.connected = false;
   this.sourceEnabled = true;
   this.socket = null;
   this.intervalID = null;
   this.unAckedMessages = [];
   this.messageId = 0;

   this.incompleteRequests = [];
   this.reqId = 0;

   this.sourceRequests = [];
   this.lastHeartbeat = Date.now() + 10000;

   this.manualDisconnect = false;

   var that = this;

   // Callbacks for event listening
   this.casaJoinedHandler = function(_data) {
   
      if (_data.peerName == that.name) {
        console.log(that.name + ': I am connected to my peer. Socket: ' + _data.socket);

        if (!that.connected) {
           that.connected = true;
           that.socket = _data.socket;
           console.log(that.name + ': Connected to my peer. Going active.');

           that.ackMessage('login', { messageId: _data.messageId, casaName: that.casa.name, casaConfig: that.casa.config });

           var casaList = that.casaArea.buildCasaForwardingList();
           var casaListLen = casaList.length;

           // Send info regarding all relevant casas
           for (var i = 0; i < casaListLen; ++i) {
              casaList[i].refreshConfigWithSourcesStatus();
              that.sendMessage('casa-active', { sourceName: casaList[i].name, casaConfig: casaList[i].config });
           }

           // listen for source changes from peer casas
           that.establishListeners(true);
           that.establishHeartbeat();

           that.resendUnAckedMessages();
           that.goActive({ sourceName: that.name });
        }
      }
   };

   this.casaLostHandler = function(_data) {

      if (_data.peerName == that.name) {
         // Cope with race between old diconnect and new connect - Ignore is sockets do not match
         if (!that.socket || (that.socket == _data.socket)) {

            console.log(that.name + ': I have lost my peer!');

            if (that.connected) {
               console.log(that.name + ': Lost connection to my peer. Going inactive.');
               that.connected = false;
               clearInterval(that.intervalID);
               that.intervalID = null;
               that.emit('broadcast-message', { message: 'casa-inactive', data: { sourceName: that.name }, sourceCasa: that.name });
               that.socket = null;
               that.goInactive({ sourceName: that.name });
            }
         }
      }
   };

   this.sourcePropertyChangedCasaHandler = function(_data) {

      if (that.connected) {
         console.log(that.name + ': publishing source ' + _data.sourceName + ' property-changed to peer casa');
         that.sendMessage('source-property-changed', _data);
      }
   };

   if (!this.proActiveConnect) {
      // Listen to Casa for my peer instance to connect
      this.casa.on('casa-joined', this.casaJoinedHandler);
      this.casa.on('casa-lost', this.casaLostHandler);
   }

   // publish source changes in this node (casa object) to remote casas
   this.casa.on('source-property-changed', this.sourcePropertyChangedCasaHandler);
}

util.inherits(PeerCasa, Source);

PeerCasa.prototype.removeCasaListeners = function() {
   console.log(this.name + ': removing casa listeners');

   if (!this.proActiveConnect) {
      this.casa.removeListener('casa-joined', this.casaJoinedHandler);
      this.casa.removeListener('casa-lost', this.casaLostHandler);
   }

   this.casa.removeListener('source-property-changed', this.sourcePropertyChangedCasaHandler);
}


PeerCasa.prototype.coldStartPeerSources = function() {

   for(var prop in this.sources) {

      if (this.sources.hasOwnProperty(prop)){
         console.log(this.name + ': Cold starting peer source ' + this.sources[prop].name);
         this.sources[prop].coldStart();
      }
   }
}

PeerCasa.prototype.invalidateSources = function() {

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

   for (var prop in this.remoteCasas) {
      if (this.remoteCasas.hasOwnProperty(prop)){
         console.log(this.name + ': Invaliding remote casa ' + this.remoteCasas[prop].name);
         var remoteCasa = this.remoteCasas[prop];
         this.remoteCasas[prop].invalidateSources();
         delete this.casaSys.allObjects[this.remoteCasas[prop].name];
         delete this.casaSys.remoteCasas[this.remoteCasas[prop].name];
         delete this.remoteCasas[prop];
         delete remoteCasa;
      }
   }
   delete this.remoteCasas;
   this.remoteCasas = [];
   this.goInvalid('ACTIVE', { sourceName: this.name });
}

PeerCasa.prototype.getHostname = function() {
   return this.address.hostname;
};

PeerCasa.prototype.getPort = function() {
   return this.address.port;
};

PeerCasa.prototype.start = function() {
   if (this.proActiveConnect) {
      this.connectToPeerCasa();
   }
}

PeerCasa.prototype.connectToPeerCasa = function() {
   var that = this;

   console.log(this.name + ': Attempting to connect to peer casa ' + this.address.hostname + ':' + this.address.port);
   this.socket = io('http://' + that.address.hostname + ':' + this.address.port + '/',  { transports: ['websocket'] } );
   //this.socket = io('http://' + that.address.hostname + ':' + this.address.port + '/');

   this.socket.on('connect', function() {
      console.log(that.name + ': Connected to my peer. Logging in...');
      that.establishListeners();
      that.establishHeartbeat();
      that.casa.refreshConfigWithSourcesStatus();

      var messageData = {
         casaName: that.casa.name,
         casaType: that.loginAs,
         casaConfig: that.casa.config
      };

      if (that.loginAs == 'child') {
         var peers = [];
         for (var prop in that.casaSys.remoteCasas) {
            if (that.casaSys.remoteCasas.hasOwnProperty(prop) && (that.casaSys.remoteCasas[prop].loginAs == 'peer')){
               peers.push(that.casaSys.remoteCasas[prop].name);
            }
         }
         if (peers.length > 0) {
            messageData.peers = peers;
         }
      }

      that.sendMessage('login', messageData);
   });

   this.socket.on('loginAACCKK', function(_data) {
      console.log(that.name + ': Login Event ACKed by my peer. Going active.');

      that.messageHasBeenAcked(_data);

      that.resendUnAckedMessages();

      that.createSources(_data, that);
      that.connected = true;

      var casaList = that.casaArea.buildCasaForwardingList();
      var casaListLen = casaList.length;

      // Send info regarding all relevant casas
      for (var i = 0; i < casaListLen; ++i) {
         that.sendMessage('casa-active', { sourceName: casaList[i].name, casaConfig: casaList[i].config });
      }  

      that.goActive({ sourceName: that.name });
   });

   this.socket.on('casa-activeAACCKK', function(_data) {
      console.log(that.name + ': casa-active Event ACKed by my peer.');
      that.messageHasBeenAcked(_data);
   });

   this.socket.on('error', function(_error) {
      console.log(that.name + ': Error received: ' + _error);

      if (that.intervalID) {
         clearInterval(that.intervalID);
         that.intervalID = null;
      }

      if (that.connected) {
         console.log(that.name + ': Lost connection to my peer. Going inactive.');
         that.connected = false;
         that.emit('broadcast-message', { message: 'casa-inactive', data: { sourceName: that.name }, sourceCasa: that.name });
         that.invalidateSources();
         that.goInactive({ sourceName: that.name });
      }

      that.deleteMeIfNeeded();
   });

   this.socket.on('disconnect', function() {
      console.log(that.name + ': Error disconnect');

      if (that.intervalID) {
         clearInterval(that.intervalID);
         that.intervalID = null;
      }

      if (that.connected) {
         console.log(that.name + ': Lost connection to my peer. Going inactive.');
         that.connected = false;
         that.emit('broadcast-message', { message: 'casa-inactive', data: { sourceName: that.name }, sourceCasa: that.name });
         that.invalidateSources();
         that.goInactive({ sourceName: that.name });
      }

      that.deleteMeIfNeeded();
   });
}

PeerCasa.prototype.deleteMeIfNeeded = function() {
   var that = this;

   if (!this.persistent) {

      setTimeout(function() {

         if (!that.connected) {
            that.socket.close();

            if (that.casaSys.remoteCasas[that.name]) {
               delete that.casaSys.remoteCasas[that.name];
               delete that.casaSys.allObjects[that.name];
            }
            delete that;
         }
      }, this.deathTime * 1000);
   }
   else if (this.manualDisconnect) {
      // Recreate socket to attempt reconnection
      this.manualDisconnect = false;
      console.log(this.name + ': Attempting to re-establish connection after manual disconnection');
      this.socket.connect();
   }
}

PeerCasa.prototype.refreshConfigWithSourcesStatus = function() {
   delete this.config.sourcesStatus;
   this.config.sourcesStatus = [];

   var len = this.config.sources.length;
   for (var i = 0; i < len; ++i) {
      this.config.sourcesStatus.push({ properties: this.sources[this.config.sources[i]].props,
                                       status: this.sources[this.config.sources[i]].isActive() });
   }
}

PeerCasa.prototype.createSources = function(_data, _peerCasa) {

   if (_data.casaConfig &&  _data.casaConfig.sources && _data.casaConfig.sourcesStatus) {
      var len = _data.casaConfig.sources.length;
      console.log(_peerCasa.name + ': New sources found = ' + len);
      console.log(_peerCasa.name + ': New sources status found = ' + _data.casaConfig.sourcesStatus.length);

      var PeerSource = require('./peersource');
      for (var i = 0; i < len; ++i) {

         if (this.casaSys.findSource(_data.casaConfig.sources[i])) {
            console.info(_peerCasa.name + ': Source ' + _data.casaConfig.sources[i] + ' already exists in local casa. Not creating Peer Source');
         }
         else {
            console.log(_peerCasa.name + ': Creating peer source named ' + _data.casaConfig.sources[i]);
            var source = new PeerSource(_data.casaConfig.sources[i], _data.casaConfig.sourcesStatus[i].properties, _peerCasa);
            this.casaSys.allObjects[source.name] = source;
         }
      }
   }

   // Refresh all inactive sources and workers
   this.casaSys.casa.refreshSourceListeners();
}

function SourceRequestor(_requestId, _source, _data) {
   this.requestId = _requestId;
   this.source = _source;
   this.data = _data;
}

SourceRequestor.prototype.setProperty = function(_property, _value, _data, _callback) {
   var that = this;

   this.source.setProperty(_property, _value, _data, function(_result) {
      _callback( { sourceName: that.source.name, requestId: that.requestId, result: _result });
   });
}

PeerCasa.prototype.isActive = function() {
   return this.connected;
}

PeerCasa.prototype.establishListeners = function(_force) {

   if (!this.listenersSetUp || _force) {
      var that = this;

      // listen for remote casas availability from peer casas
      this.socket.on('casa-active', function(_data) {
         console.log('casa area ' + that.casaArea.name);
         console.log(that.name + ': Event received from my peer. Event name: casa-active, casa: ' + _data.sourceName);
         that.emit('broadcast-message', { message: 'casa-active', data:_data, sourceCasa: that.name });

         if (!that.casaSys.remoteCasas[_data.sourceName] && _data.sourceName != that.casa.name) {
            // Create a remote casa to represent the newly available casa
            RemoteCasa = require('./remotecasa');
            var remoteCasa = new RemoteCasa(_data.casaConfig, that);
            that.remoteCasas[remoteCasa.name] = remoteCasa;
            that.casaSys.remoteCasas[remoteCasa.name] = remoteCasa;
            that.casaSys.allObjects[remoteCasa.name] = remoteCasa;
            that.createSources(_data, remoteCasa);
         }
         that.emit('casa-active', _data);
         that.ackMessage('casa-active', _data);
      });

      this.socket.on('casa-inactive', function(_data) {
         console.log(that.name + ': Event received from my peer. Event name: casa-inactive, casa: ' + _data.sourceName);
         that.emit('broadcast-message', { message: 'casa-inactive', data:_data, sourceCasa: that.name });
         that.emit('casa-inactive', _data);

         var remoteCasa = that.casaSys.remoteCasas[_data.sourceName];

         if (remoteCasa && remoteCasa.loginAs == 'remote') {
            remoteCasa.invalidateSources();
            delete that.remoteCasas[remoteCasa.name];
            delete that.casaSys.remoteCasas[remoteCasa.name];
            delete that.casaSys.allObjects[remoteCasa.name];
            delete remoteCasa;
         }
         that.ackMessage('casa-inactive', _data);
      });

      this.socket.on('source-property-changed', function(_data) {
         console.log(that.name + ': Event received from my peer. Event name: property-changed, source: ' + _data.sourceName);
         that.emit('source-property-changed', _data);
         that.emit('broadcast-message', { message: 'source-property-changed', data:_data, sourceCasa: that.name });

         if (that.sources[_data.sourceName]) {
            that.sources[_data.sourceName].sourceHasChangedProperty(_data);
         }
         that.ackMessage('source-property-changed', _data);
      });

      this.socket.on('set-source-property-req', function(_data) {
         console.log(that.name + ': Event received from my peer. Event name: set-source-property-req, source: ' + _data.sourceName);
         var source = that.casaSys.findSource(_data.sourceName);

         if (source) {
            _data.acker = that.casa.name;
            that.ackMessage('set-source-property-req', _data);

            that.sourceRequests[_data.requestId] = new SourceRequestor(_data.requestId, source, _data);
            that.sourceRequests[_data.requestId].setProperty(_data.property, _data.value, _data, function(_resp) {
               that.socket.emit('set-source-property-resp', { sourceName: _resp.sourceName, requestId: _resp.requestId, result: _resp.result, requestor: _data.requestor });
               delete that.sourceRequests[ _resp.requestId];
            });
         } 
         else {
            // TBD Find the casa that ownes the source and work out how to foward the request
            that.emit('forward-request', { message: 'set-source-property-req', data: _data, sourceCasa: that.name });
         }
      });

      this.socket.on('set-source-property-resp', function(_data) {
         console.log(that.name + ': Event received from my peer. Event name: set-source-property-resp, source: ' + _data.sourceName);

         if (_data.requestor == that.casa.name) {
            // Request origniated from here
            _data.acker = that.casa.name;
            that.ackMessage('set-source-property-resp', _data);

            if (that.incompleteRequests[_data.requestId]) {
               that.incompleteRequests[_data.requestId].completeRequest(_data.result);
               delete that.incompleteRequests[_data.requestId];
            }
         }
         else {
            // Find the casa that ownes the original request and work out how to foward the response
            that.emit('forward-response', { message: 'set-source-property-resp', data: _data, sourceCasa: that.name });
         }
      });

      this.socket.on('source-property-changedAACCKK', function(_data) {
         console.log(that.name + ': Property-changed Event ACKed by my peer. Source=' + _data.sourceName);
         that.messageHasBeenAcked(_data);
      });

      this.socket.on('set-source-property-reqAACCKK', function(_data) {
         console.log(that.name + ': set source property request event ACKed by my peer. *Not confirmed*. Source=' + _data.sourceName);

         if (_data.requestor == that.casa.name) {
            // We made the request
            that.messageHasBeenAcked(_data);

            if (that.incompleteRequests[_data.requestId]) {
               that.incompleteRequests[_data.requestId].ackRequest();
            }
         }
         else {
            // we didn't make the request, so forward the ACK
            that.emit('forward-request', { message: 'set-source-property-reqAACCKK', data: _data});
         }
      });

      this.socket.on('set-source-property-respAACCKK', function(_data) {
         console.log(that.name + ': set source property response event ACKed by my peer. Source=' + _data.sourceName);

         if (_data.requestor == that.casa.name) {
            // We made the request
            that.messageHasBeenAcked(_data);
         }
         else {
            // we didn't make the request, so forward the ACK
            that.emit('forward-response', { message: 'set-source-property-respAACCKK', data: _data});
         }
      });

      this.socket.on('heartbeat', function(_data) {
         console.log(that.name + ': Heartbeat received');

         that.lastHeartbeat = Date.now();
      });

      this.listenersSetUp = true;
   }
}

PeerCasa.prototype.establishHeartbeat = function() {
   var that = this;
   this.lastHeartbeat = Date.now() + 10000;

   if (!this.intervalID) {
      // Establish heartbeat
      this.intervalID = setInterval(function(){

         if (that.connected) {

            // Check if we have received a heartbeat from the other side recently
            if ((Date.now() - that.lastHeartbeat) > 90000) {
               console.log(that.name + ': No heartbeat received for 1.5 times interval!. Closing socket.');
               that.manualDisconnect = true;
               that.socket.disconnect();
            }
            else {
               console.log(that.name + ': Last heartbeat time difference = ', Date.now() - that.lastHeartbeat);
               that.socket.emit('heartbeat', { casaName: that.casa.name });
            }
         }
      }, 60000);
   }
}

PeerCasa.prototype.sendMessage = function(_message, _data) {
   var id = this.name + ':active:' + this.reqId;
   this.messageId = (this.messageId +  1) % 10000;
   _data.messageId = id;
   this.unAckedMessages[id] = { message: _message, data: _data };
   this.socket.emit(_message, _data);
}

PeerCasa.prototype.ackMessage = function(_message, _data) {
   if (_data.messageId) {
      this.socket.emit(_message + 'AACCKK', _data);
   }
}

PeerCasa.prototype.messageHasBeenAcked = function(_data) {

   if (_data.messageId && this.unAckedMessages[_data.messageId]) {
      delete this.unAckedMessages[_data.messageId];
      this.unAckedMessages[_data.messageId] = undefined;
   }
}

PeerCasa.prototype.resendUnAckedMessages = function() {
   var that = this;

   for(var prop in this.unAckedMessages) {

      if(this.unAckedMessages.hasOwnProperty(prop)){
         that.socket.emit(this.unAckedMessages[prop].message, this.unAckedMessages[prop].data);
      }
   }

   var toDelete = [];
   for(var prop2 in this.incompleteRequests) {

      if(this.incompleteRequests.hasOwnProperty(prop2)){
         this.incompleteRequests[prop2].resendRequest(function(_requestId) {
            toDelete.push(requestId);
         });
      }
   }

   // Clean up any already acked messages
   toDelete.forEach(function(_requestId) {
      delete that.incompleteRequests[_requestId];
   });

}

function RemoteCasaRequestor(_requestId, _callback, _socket) {
   this.requestId = _requestId;
   this.callback = _callback;
   this.socket = _socket;
   this.acked = false;
   this.timeout = null;
   this.message = null;;
}

RemoteCasaRequestor.prototype.sendRequest = function(_message, _deleteMe) {
   var that = this;
   this.message = _message;
   this.socket.emit(this.message.message, this.message.data);
   this.timeout = setTimeout(function() {
      that.callback(false);
      _deleteMe(that.requestId);
   }, 30000);
}

RemoteCasaRequestor.prototype.resendRequest = function(_deleteMe) {
   var that = this;

   if (this.acked) {
      // remote casa has already received the request, we will never know the result :-)
      this.callback(false);
      _deleteMe(this.requestId);
   }
   else {
      if (this.timeout) {
         clearTimeout(this.timeout);
      }

      this.socket.emit(this.message.message, this.message.data);

      this.timeout = setTimeout(function() {
         that.callback(false);
         _deleteMe(that.requestId);
      }, 30000);
   }
}

RemoteCasaRequestor.prototype.ackRequest = function() {
   this.acked = true;
}

RemoteCasaRequestor.prototype.completeRequest = function(_result) {
   clearTimeout(this.timeout);
   this.callback(_result);
}

PeerCasa.prototype.setSourceActive = function(_source, _data, _callback) {
   this.setSourceProperty(_source, "ACTIVE", true, _data, _callback);
}

PeerCasa.prototype.setSourceInactive = function(_source, _data, _callback) {
   this.setSourceProperty(_source, "ACTIVE", false, _data, _callback);
}

PeerCasa.prototype.setSourceProperty = function(_source, _propName, _propValue, _data, _callback) {
   var that = this;

   if (this.connected) {
      console.log(this.name + ': requesting source change property ' + _propName + ' to ' + _propValue + ' from peer casa. Source ' + _source.name);
      var id = this.name + ':changeprop:' + this.reqId;
      this.reqId = (this.reqId +  1) % 10000;
      var message = { message: 'set-source-property-req', data: { casaName: this.name, sourceName: _source.name,
                                                                  property: _propName, value: _propValue,
                                                                  requestId: id, requestor: this.casa.name } };

      this.incompleteRequests[id] = new RemoteCasaRequestor(id, _callback, this.socket);
      this.incompleteRequests[id].sendRequest(message, function(_requestId) {
         console.log(that.name + ': Timeout occurred sending a changeProperty request for source ' + _source.name);
         delete that.incompleteRequests[_requestId];
      });
   }
   else {
      _callback(false);
   }
}

PeerCasa.prototype.addSource = function(_source) {
   // Peer source being added to peer casa
   console.log(this.name + ': Source '  +_source.name + ' added to peercasa ');
   this.sources[_source.name] = _source;
   console.log(this.name + ': ' + _source.name + ' associated!');
}

PeerCasa.prototype.addWorker = function(_worker) {
   console.log(this.name + ': Worker '  + _worker.name + ' added to peercasa ');
   this.workers[_worker.name] = _worker;
}

PeerCasa.prototype.setCasaArea = function(_casaArea) {
   var that = this;

   var broadcastCallback = function(_message) {
      console.log(that.name + ': received message ' + _message.message + ' originally from ' + _message.data.sourceName + ' passed on from casa ' + _message.sourceCasa);
      console.log(that.connected.toString() + ' ' + _message.sourceCasa + ' ' + that.name);

      if (that.connected && _message.sourceCasa != that.name) {
         console.log(this.name + ': publishing message ' + _message.message + ' orginally from ' + _message.data.sourceName + ' passed on from casa ' + _message.sourceCasa);
         that.sendMessage(_message.message, _message.data);
      }
   };

   if (this.casaArea != _casaArea) {

      if (this.casaArea) {
         this.casaArea.removeCasa(this);
         this.casaArea.removeListener('broadcast-message', broadcastCallback);
      }

      this.casaArea = _casaArea;

      if (this.casaArea) {
         this.casaArea.addCasa(this);
         // listen for broadcast messages from other nodes to remote casas
         this.casaArea.on('broadcast-message', broadcastCallback);
      }
   }
}

module.exports = exports = PeerCasa;

