var util = require('util');
var Thing = require('./thing');
var S = require('string');
var io = require('socket.io-client');
var CasaSystem = require('./casasystem');

function PeerCasa(_config) {
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

   Thing.call(this, _config);

   this.states = [];
   this.activators = [];
   this.actions = [];

   this.listenersSetUp = false;
   this.casaListeners = [];

   this.connected = false;
   this.sourceEnabled = true;
   this.socket = null;
   this.intervalID = null;
   this.unAckedMessages = [];

   this.incompleteRequests = [];
   this.reqId = 0;

   this.stateRequests = [];

   var that = this;

   // Callbacks for event listening
   this.casaJoinedHandler = function(_data) {
   
      if (_data.peerName == that.name) {
        console.log(that.name + ': I am connected to my peer. Socket: ' + _data.socket);

        if (!that.connected) {
           that.connected = true;
           that.socket = _data.socket;
           console.log(that.name + ': Connected to my peer. Going active.');

           if (_data.states) {
              console.log(_data.states);
           }

           // listen for state and activator changes from peer casas
           that.establishListeners(true);
           that.establishHeartbeat();

           if (that.unAckedMessages.length > 1) {
               resendUnAckedMessages();
            }

           that.emit('active', { sourceName: that.name });
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
               that.emit('inactive', { sourceName: that.name });
            }
         }
      }
   };

   this.stateActiveCasaHandler = function(_data) {

      if (that.connected) {
         console.log(that.name + ': publishing state ' + _data.sourceName + ' active to peer casa');
         that.unAckedMessages.push( { message: 'state-active', data: _data } );
         that.socket.emit('state-active', _data);
      }
   };

   this.stateInactiveCasaHandler = function(_data) {

      if (that.connected) {
         console.log(that.name + ': publishing state ' + _data.sourceName + ' inactive to peer casa');
         that.unAckedMessages.push( { message: 'state-inactive', data: _data } );
         that.socket.emit('state-inactive', _data);
      }
   };

   // publish activator changes to remote casas
   this.activatorActiveCasaHandler = function(_data) {

      if (that.connected) {
         console.log(that.name + ': publishing activator ' + _data.sourceName + ' active to peer casa');
         that.unAckedMessages.push( { message: 'activator-active', data: _data } );
         that.socket.emit('activator-active', _data);
      }
   };

   this.activatorInactiveCasaHandler = function(_data) {

      if (that.connected) {
         console.log(that.name + ': publishing activator ' + _data.sourceName + ' inactive to peer casa');
         that.unAckedMessages.push( { message: 'activator-inactive', data: _data } );
         that.socket.emit('activator-inactive', _data);
      }
   };

   if (!this.proActiveConnect) {
      // Listen to Casa for my peer instance to connect
      this.casa.on('casa-joined', this.casaJoinedHandler);
      this.casa.on('casa-lost', this.casaLostHandler);
   }

   // publish state changes in this node (casa object) to remote casas
   this.casa.on('state-active', this.stateActiveCasaHandler);
   this.casa.on('state-inactive', this.stateInactiveCasaHandler);

   // publish activator changes to remote casas
   this.casa.on('activator-active', this.activatorActiveCasaHandler);
   this.casa.on('activator-inactive', this.activatorInactiveCasaHandler);
}

util.inherits(PeerCasa, Thing);

PeerCasa.prototype.removeCasaListeners = function() {
   console.log(this.name + ': removing casa listeners');

   if (!this.proActiveConnect) {
      this.casa.removeListener('casa-joined', this.casaJoinedHandler);
      this.casa.removeListener('casa-lost', this.casaLostHandler);
   }

   this.casa.removeListener('state-active', this.stateActiveCasaHandler);
   this.casa.removeListener('state-inactive', this.stateInactiveCasaHandler);
   this.casa.removeListener('activator-active', this.activatorActiveCasaHandler);
   this.casa.removeListener('activator-inactive', this.activatorInactiveCasaHandler);
}

PeerCasa.prototype.invalidateSources = function() {

   for(var prop in this.states) {

      if(this.states.hasOwnProperty(prop)){
         console.log(this.name + ': Invaliding state ' + this.states[prop].name);
         this.states[prop].invalidateSource();
         delete this.casaSys.allObjects[this.states[prop].name];
         delete this.states[prop];
      }
   }

   for(var prop in this.activators) {

      if(this.activators.hasOwnProperty(prop)){
         console.log(this.name + ': Invaliding activator ' + this.activators[prop].name);
         this.activators[prop].invalidateSource();
         delete this.casaSys.allObjects[this.activators[prop].name];
         delete this.activators[prop];
      }
   }

   delete this.states;
   delete this.activators;
   this.states = [];
   this.activators = [];

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
   this.emit('invalid', { sourceName: this.name });
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
   this.socket = io('http://' + that.address.hostname + ':' + this.address.port + '/');

   this.socket.on('connect', function() {
      console.log(that.name + ': Connected to my peer. Logging in...');
      that.establishListeners();
      that.establishHeartbeat();
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

      that.unAckedMessages.push( { message: 'login', data: messageData } );
      that.socket.emit('login', messageData);
   });

   this.socket.on('loginAACCKK', function(_data) {
      console.log(that.name + ': Login Event ACKed by my peer. Going active.');

      that.unAckedMessages.pop();  // Remove Login

      if (that.unAckedMessages.length > 1) {
         that.resendUnAckedMessages();
      }
      that.createStatesAndActivators(_data, that);
      that.connected = true;

      var casaList = that.casaArea.buildCasaForwardingList();
      var casaListLen = casaList.length;

      // Send info regarding all relevant casas
      for (var i = 0; i < casaListLen; ++i) {
         that.unAckedMessages.push( { message: 'casa-active', data: { sourceName: casaList[i].name, casaConfig: casaList[i].config }});
         that.socket.emit('casa-active', { sourceName: casaList[i].name, casaConfig: casaList[i].config });
      }  

      that.emit('active', { sourceName: that.name });
   });

   this.socket.on('casa-activeAACCKK', function(_data) {
      console.log(that.name + ': casa-active Event ACKed by my peer.');
      that.unAckedMessages.pop();  // Remove casa-active event from resend queue
   });

   this.socket.on('error', function(_error) {
      console.log(that.name + ': Error received: ' + _error);

      if (that.connected) {
         console.log(that.name + ': Lost connection to my peer. Going inactive.');
         that.connected = false;
         clearInterval(that.intervalID);
         that.intervalID = null;
         that.emit('broadcast-message', { message: 'casa-inactive', data: { sourceName: that.name }, sourceCasa: that.name });
         that.invalidateSources();
         that.emit('inactive', { sourceName: that.name });
         that.deleteMeIfNeeded();
      }
   });

   this.socket.on('disconnect', function() {
      console.log(that.name + ': Error disconnect');

      if (that.connected) {
         console.log(that.name + ': Lost connection to my peer. Going inactive.');
         that.connected = false;
         clearInterval(that.intervalID);
         that.intervalID = null;
         that.emit('broadcast-message', { message: 'casa-inactive', data: { sourceName: that.name }, sourceCasa: that.name });
         that.invalidateSources();
         that.emit('inactive', { sourceName: that.name });
         that.deleteMeIfNeeded();
      }
   });
}

PeerCasa.prototype.deleteMeIfNeeded = function() {
   var that = this;

   if (!this.persistent) {

      setTimeout(function() {

         if (!that.connected) {
            that.socket.close();
            delete that.casaSys.remoteCasas[that.name];
            delete that.casaSys.allObjects[that.name];
            delete that;
         }
      }, this.deathTime * 1000);
   }
}

PeerCasa.prototype.createStatesAndActivators = function(_data, _peerCasa) {

   if (_data.casaConfig &&  _data.casaConfig.states) {
      var len = _data.casaConfig.states.length;
      console.log(_peerCasa.name + ': New states found = ' + len);

      var PeerState = require('./peerstate');
      for (var i = 0; i < len; ++i) {
         console.log(_peerCasa.name + ': Creating peer state named ' + _data.casaConfig.states[i]);
         var source = new PeerState(_data.casaConfig.states[i], _peerCasa);
         this.casaSys.allObjects[source.name] = source;
      }
   }

   if (_data.casaConfig &&  _data.casaConfig.activators) {
      var len = _data.casaConfig.activators.length;
      console.log(_peerCasa.name + ': New activators found = ' + len);

      var PeerActivator = require('./peeractivator');
      for (i = 0; i < len; ++i) {
         console.log(_peerCasa.name + ': Creating peer activator named ' + _data.casaConfig.activators[i]);
         var source = new PeerActivator(_data.casaConfig.activators[i], _peerCasa);
         this.casaSys.allObjects[source.name] = source;
      }
   }

   // Refresh all inactive activators and actions
   this.casaSys.casa.refreshActivatorsAndActions();
}

function StateRequestor(_requestId, _state) {
   this.requestId = _requestId;
   this.state = _state;
}

StateRequestor.prototype.setActive = function(_callback) {
   var that = this;
   this.state.setActive(function(_result) {
      _callback( { stateName: that.state.name, requestId: that.requestId, result: _result });
   });
}

StateRequestor.prototype.setInactive = function(_callback) {
   var that = this;
   this.state.setInactive(function(_result) {
      _callback( { stateName: that.state.name, requestId: that.requestId, result: _result });
   });
}

StateRequestor.prototype.isActive = function(_callback) {
   var that = this;
   this.state.isActive(function(_result) {
      _callback( { stateName: that.state.name, requestId: that.requestId, result: _result });
   });
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
            that.createStatesAndActivators(_data, remoteCasa);
         }
         that.emit('casa-active', _data);
         that.socket.emit('casa-activeAACCKK', _data);
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
         that.socket.emit('casa-inactiveAACCKK', _data);
      });

      // listen for state changes from peer casas
      this.socket.on('state-active', function(_data) {
         console.log(that.name + ': Event received from my peer. Event name: active, state: ' + _data.sourceName);
         that.emit('state-active', _data);
         that.emit('broadcast-message', { message: 'state-active', data:_data, sourceCasa: that.name });

         if (that.states[_data.sourceName]) {
            that.states[_data.sourceName].stateHasGoneActive(_data);
         }
         that.socket.emit('state-activeAACCKK', _data);
      });

      this.socket.on('state-inactive', function(_data) {
         console.log(that.name + ': Event received from my peer. Event name: inactive, state: ' + _data.sourceName);
         that.emit('state-inactive', _data);
         that.emit('broadcast-message', { message: 'state-inactive', data:_data, sourceCasa: that.name });

         if (that.states[_data.sourceName]) {
            that.states[_data.sourceName].stateHasGoneInactive(_data);
         }
         that.socket.emit('state-inactiveAACCKK', _data);
      });

      // listen for activator changes from peer casas
      this.socket.on('activator-active', function(_data) {
         console.log(that.name + ': Event received from my peer. Event name: active, activator: ' + _data.sourceName);
         that.emit('activator-active', _data);
         that.emit('broadcast-message', { message: 'activator-active', data:_data, sourceCasa: that.name });

         if (that.activators[_data.sourceName]) {
            that.activators[_data.sourceName].activatorHasGoneActive(_data);
         }
         that.socket.emit('activator-activeAACCKK', _data);
      });

      this.socket.on('activator-inactive', function(_data) {
         console.log(that.name + ': Event received from my peer. Event name: inactive, activator: ' + _data.sourceName);
         that.emit('activator-inactive', _data);
         that.emit('broadcast-message', { message: 'activator-inactive', data:_data, sourceCasa: that.name });

         if (that.activators[_data.sourceName]) {
            that.activators[_data.sourceName].activatorHasGoneInactive(_data);
         }
         that.socket.emit('activator-inactiveAACCKK', _data);
      });

      this.socket.on('set-state-active-req', function(_data) {
         console.log(that.name + ': Event received from my peer. Event name: set-state-active-req, state: ' + _data.stateName);
         var state = that.casa.findState(_data.stateName);

         if (state) {
            _data.acker = that.casa.name;
            that.socket.emit('set-state-active-reqAACCKK', _data);
            that.stateRequests[_data.requestId] = new StateRequestor(_data.requestId, state);
            that.stateRequests[_data.requestId].setActive(function(_resp) {
               that.socket.emit('set-state-active-resp', { stateName: _resp.stateName, requestId: _resp.requestId, result: _resp.result, requestor: _data.requestor });
               delete that.stateRequests[ _resp.requestId];
            });
         } 
         else {
            // TBD Find the casa that ownes the state and work out how to foward the request
            that.emit('forward-request', { message: 'set-state-active-req', data: _data, sourceCasa: that.name });
         }
      });

      this.socket.on('set-state-inactive-req', function(_data) {
         console.log(that.name + ': Event received from my peer. Event name: set-state-inactive-req, state: ' + _data.stateName);
         var state = that.casa.findState(_data.stateName);

         if (state) {
            _data.acker = that.casa.name;
            that.socket.emit('set-state-inactive-reqAACCKK', _data);
            that.stateRequests[_data.requestId] = new StateRequestor(_data.requestId, state);
            that.stateRequests[_data.requestId].setInactive(function(_resp) {
               that.socket.emit('set-state-inactive-resp', { stateName: _resp.stateName, requestId: _resp.requestId, result: _resp.result, requestor: _data.requestor });
               delete that.stateRequests[ _resp.requestId];
            });
         }
         else {
            // TBD Find the casa that ownes the state and work out how to foward the request
            that.emit('forward-request', { message: 'set-state-inactive-req', data: _data, sourceCasa: that.name });
         }
      });

      this.socket.on('get-state-active-req', function(_data) {
         console.log(that.name + ': Event received from my peer. Event name: get-state-active-req, state: ' + _data.stateName);
         var state = that.casa.findState(_data.stateName);

         if (state) {
            _data.acker = that.casa.name;
            that.socket.emit('get-state-active-reqAACCKK', _data);
            that.stateRequests[_data.requestId] = new StateRequestor(_data.requestId, state);
            that.stateRequests[_data.requestId].isActive(function(_resp) {
               that.socket.emit('set-state-inactive-resp', { stateName: _resp.stateName, requestId: _resp.requestId, result: _resp.result, requestor: _data.requestor });
               delete that.stateRequests[ _resp.requestId];
            });
         }
         else {
            // TBD Find the casa that ownes the state and work out how to foward the request
            that.emit('forward-request', { message: 'get-state-active-req', data: _data, sourceCasa: that.name });
         }
      });

      this.socket.on('set-state-active-resp', function(_data) {
         console.log(that.name + ': Event received from my peer. Event name: set-state-active-resp, state: ' + _data.stateName);

         if (_data.requestor == that.casa.name) {
            // Request origniated from here
            _data.acker = that.casa.name;
            that.socket.emit('set-state-active-respAACCKK', _data);

            if (that.incompleteRequests[_data.requestId]) {
               that.incompleteRequests[_data.requestId].completeRequest(_data.result);
               delete that.incompleteRequests[_data.requestId];
            }
         }
         else {
            // Find the casa that ownes the original request and work out how to foward the response
            that.emit('forward-response', { message: 'set-state-active-resp', data: _data, sourceCasa: that.name });
         }
      });

      this.socket.on('set-state-inactive-resp', function(_data) {
         console.log(that.name + ': Event received from my peer. Event name: set-state-inactive-resp, state: ' + _data.stateName);

         if (_data.requestor == that.casa.name) {
            // Request origniated from here
            _data.acker = that.casa.name;
            that.socket.emit('set-state-inactive-respAACCKK', _data);

            if (that.incompleteRequests[_data.requestId]) {
               that.incompleteRequests[_data.requestId].completeRequest(_data.result);
               delete that.incompleteRequests[_data.requestId];
            }
         }
         else {
            // Find the casa that ownes the original request and work out how to foward the response
            that.emit('forward-response', { message: 'set-state-inactive-resp', data: _data, sourceCasa: that.name });
         }
      });

      this.socket.on('get-state-active-resp', function(_data) {
         console.log(that.name + ': Event received from my peer. Event name: get-state-active-resp, state: ' + _data.stateName);

         if (_data.requestor == that.casa.name) {
            // Request origniated from here
            _data.acker = that.casa.name;
            that.socket.emit('get-state-active-respAACCKK', _data);

            if (that.incompleteRequests[_data.requestId]) {
               that.incompleteRequests[_data.requestId].completeRequest(_data.result);
               delete that.incompleteRequests[_data.requestId];
            }
         }
         else {
            // Find the casa that ownes the original request and work out how to foward the response
            that.emit('forward-response', { message: 'get-state-active-resp', data: _data, sourceCasa: that.name });
         }
      });

      this.socket.on('state-activeAACCKK', function(_data) {
         console.log(that.name + ': Active Event ACKed by my peer.');
         that.unAckedMessages.shift();
      });

      this.socket.on('state-inactiveAACCKK', function(_data) {
         console.log(that.name + ': Inactive Event ACKed by my peer.');
         that.unAckedMessages.shift();
      });

      this.socket.on('activator-activeAACCKK', function(_data) {
         console.log(that.name + ': Active Event ACKed by my peer.');
         that.unAckedMessages.shift();
      });

      this.socket.on('activator-inactiveAACCKK', function(_data) {
         console.log(that.name + ': Inactive Event ACKed by my peer.');
         that.unAckedMessages.shift();
      });

      this.socket.on('set-state-active-reqAACCKK', function(_data) {
         console.log(that.name + ': set state active request event ACKed by my peer. *Not confirmed*');

         if (_data.requestor == that.casa.name) {
            // We made the request

            if (that.incompleteRequests[_data.requestId]) {
               that.incompleteRequests[_data.requestId].ackRequest();
            }
         }
         else {
            // we didn't make the request, so forward the ACK
            that.emit('forward-request', { message: 'set-state-active-reqAACCKK', data: _data});
         }
      });

      this.socket.on('set-state-inactive-reqAACCKK', function(_data) {
         console.log(that.name + ': set state inactive request event ACKed by my peer. *Not confirmed*');

         if (_data.requestor == that.casa.name) {
            // We made the request

            if (that.incompleteRequests[_data.requestId]) {
               that.incompleteRequests[_data.requestId].ackRequest();
            }
         }
         else {
            // we didn't make the request, so forward the ACK
            that.emit('forward-request', { message: 'set-state-inactive-reqAACCKK', data: _data});
         }
      });

      this.socket.on('get-state-active-reqAACCKK', function(_data) {
         console.log(that.name + ': get state active request event ACKed by my peer. *Not confirmed*');

         if (_data.requestor == that.casa.name) {
            // We made the request

            if (that.incompleteRequests[_data.requestId]) {
               that.incompleteRequests[_data.requestId].ackRequest();
            }
         }
         else {
            // we didn't make the request, so forward the ACK
            that.emit('forward-request', { message: 'get-state-active-reqAACCKK', data: _data});
         }
      });

      this.socket.on('set-state-active-respAACCKK', function(_data) {
         console.log(that.name + ': set state active response event ACKed by my peer.');

         if (_data.requestor == that.casa.name) {
            // We made the request
            that.unAckedMessages.shift();
         }
         else {
            // we didn't make the request, so forward the ACK
            that.emit('forward-response', { message: 'set-state-active-respAACCKK', data: _data});
         }
      });

      this.socket.on('set-state-inactive-respAACCKK', function(_data) {
         console.log(that.name + ': set state inactive response event ACKed by my peer.' );

         if (_data.requestor == that.casa.name) {
            // We made the request
            that.unAckedMessages.shift();
         }
         else {
            // we didn't make the request, so forward the ACK
            that.emit('forward-response', { message: 'set-state-inactive-respAACCKK', data: _data});
         }
      });

      this.socket.on('get-state-active-respAACCKK', function(_data) {
         console.log(that.name + ': get state active response event ACKed by my peer.' );

         if (_data.requestor == that.casa.name) {
            // We made the request
            that.unAckedMessages.shift();
         }
         else {
            // we didn't make the request, so forward the ACK
            that.emit('forward-response', { message: 'get-state-active-respAACCKK', data: _data});
         }
      });

      this.socket.on('heartbeat', function(_data) {
         // do nothing!
         console.log(that.name + ': Heartbeat received');
      });

      this.listenersSetUp = true;
   }
}

PeerCasa.prototype.establishHeartbeat = function() {
   var that = this;

   if (!this.intervalID) {
      // Establish heartbeat
      this.intervalID = setInterval(function(){

         if (that.connected) {
            that.socket.emit('heartbeat', { casaName: that.casa.name });
         }
      }, 60000);
   }
}

PeerCasa.prototype.resendUnAckedMessages = function() {
   var that = this;

   this.unAckedMessages.forEach(function(_message) {
      if (_message) {
         that.socket.emit(_message.message, _message.data);
      }
   });

   var toDelete = [];
   this.incompleteRequests.forEach(function(_request, index) {
      if (_request) {
         _request.resendRequest(function(_requestId) {
            toDelete.push(requestId);
         });
      }
   });

   // Clean up any already acked messages
   toDelete.forEach(function(_requestId) {
      delete that.incompleteRequests[_requestId];
   });

}

PeerCasa.prototype.addState = function(_state) {
   // Peer state being added to peer casa
   console.log(this.name + ': State '  +_state.name + ' added to peercasa ');
   this.states[_state.name] = _state;
   console.log(this.name + ': ' + _state.name + ' associated!');
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
         clearTimeout(this,timeout);
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

PeerCasa.prototype.setStateActive = function(_state, _callback) {
   var that = this;

   if (this.connected) {
      console.log(this.name + ': requesting state change to active from peer casa. State ' + _state.name);
      var id = this.name + ':active:' + this.reqId;
      this.reqId = (this.reqId +  1) % 10000;
      var message = { message: 'set-state-active-req', data: { casaName: this.name, stateName: _state.name, requestId: id, requestor: this.casa.name } };
      this.incompleteRequests[id] = new RemoteCasaRequestor(id, _callback, this.socket);
      this.incompleteRequests[id].sendRequest(message, function(_requestId) {
         console.log(that.name + ': Timeout occurred sending a setActive request for state ' + _state.name);
         delete that.incompleteRequests[_requestId];
      });
   }
   else {
      _callback(false);
   }
}

PeerCasa.prototype.setStateInactive = function(_state, _callback) {
   var that = this;

   if (this.connected) {
      console.log(this.name + ': requesting state change to inactive from peer casa. State ' + _state.name);
      var id = this.name + ':inactive:' + this.reqId;
      this.reqId = (this.reqId +  1) % 10000;
      var message = { message: 'set-state-inactive-req', data: { casaName: this.name, stateName: _state.name, requestId: id, requestor: this.casa.name } };
      this.incompleteRequests[id] = new RemoteCasaRequestor(id, _callback, this.socket);
      this.incompleteRequests[id].sendRequest(message, function(_requestId) {
         console.log(that.name + ': Timeout occurred sending a setActive request for state ' + _state.name);
         delete that.incompleteRequests[_requestId];
      });
   }
   else {
      _callback(false);
   }
}

PeerCasa.prototype.isStateActive = function(_state, _callback) {
   var that = this;

   if (this.connected) {
      console.log(this.name + ': requesting is state active from peer casa. State ' + _state.name);
      var id = this.name + ':isactive:' + this.reqId;
      this.reqId = (this.reqId +  1) % 10000;
      var message = { message: 'get-state-active-req', data: { casaName: this.name, stateName: _state.name, requestId: id, requestor: this.casa.name } };
      this.incompleteRequests[id] = new RemoteCasaRequestor(id, _callback, this.socket);
      this.incompleteRequests[id].sendRequest(message, function(_requestId) {
         console.log(that.name + ': Timeout occurred sending a isActive request for state ' + _state.name);
         delete that.incompleteRequests[_requestId];
      });
   }
   else {
      _callback(false);
   }
}

PeerCasa.prototype.addActivator = function(_activator) {
   // Peer acivator being added to peer casa
   console.log(this.name + ': Activator '  +_activator.name + ' added to peercasa ');
   this.activators[_activator.name] = _activator;
   console.log(this.name + ': ' + _activator.name + ' associated!');
}

PeerCasa.prototype.addAction = function(_action) {
   console.log(this.name + ': Action '  + _action.name + ' added to peercasa ');
   this.actions[_action.name] = _action;
   var that = this;
}

PeerCasa.prototype.setCasaArea = function(_casaArea) {
   var that = this;

   var broadcastCallback = function(_message) {
      console.log(that.name + ': received message ' + _message.message + ' originally from ' + _message.data.sourceName + ' passed on from casa ' + _message.sourceCasa);
      console.log(that.connected.toString() + ' ' + _message.sourceCasa + ' ' + that.name);

      if (that.connected && _message.sourceCasa != that.name) {
         console.log(this.name + ': publishing message ' + _message.message + ' orginally from ' + _message.data.sourceName + ' passed on from casa ' + _message.sourceCasa);
         that.unAckedMessages.push( { message: _message.message, data: _message.data } );
         that.socket.emit(_message.message, _message.data);
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

