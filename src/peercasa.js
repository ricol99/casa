var util = require('util');
var Thing = require('./thing');
var S = require('string');
var io = require('socket.io-client');
var CasaSystem = require('./casasystem');

function PeerCasa(_config) {
   var casaSys = CasaSystem.mainInstance();
   this.casa = casaSys.findCasa(_config.casa);
   this.casaArea = casaSys.findCasaArea(_config.casaArea);

   this.proActiveConnect = _config.proActiveConnect;
   this.address = _config.address;

   _config.owner = this.casaArea;

   Thing.call(this, _config);

   this.states = [];
   this.activators = [];
   this.actions = [];

   this.listenersSetUp = false;
   this.connected = false;
   this.socket = null;
   this.intervalID = null;
   this.unAckedMessages = [];

   this.incompleteRequests = [];
   this.reqId = 0;

   this.stateRequests = [];

   var that = this;

   this.casaArea.addCasa(this);

   if (this.proActiveConnect) {
      // My role is to connect to my remote instance
      this.connectToPeerCasa();
   }
   else {
      // Listen to Casa for my remote instance to connect
      this.casa.on('casa-joined', function(_data) {
      
         if (_data.peerName == S(that.name).strip('peer-')) {
           console.log(that.name + ': I am connected to my peer. Socket: ' + _data.socket);

           if (!that.connected) {
              that.connected = true;
              that.socket = _data.socket;
              console.log(that.name + ': Connected to my peer. Going active.');

              // listen for state and activator changes from peer casas
              that.establishListeners(true);
              that.establishHeartbeat();

              if (that.unAckedMessages.length > 1) {
                  resendUnAckedMessages();
               }

              that.emit('active', { sourceName: that.name });
           }
         }
      });

      this.casa.on('casa-lost', function(_data) {

         if (_data.peerName == S(that.name).strip('peer-')) {
            // Cope with race between old diconnect and new connect - Ignore is sockets do not match
            if (!that.socket || (that.socket == _data.socket)) {

               console.log(that.name + ': I have lost my peer!');

               if (that.connected) {
                  console.log(that.name + ': Lost connection to my peer. Going inactive.');
                  that.connected = false;
                  clearInterval(that.intervalID);
                  that.intervalID = null;
                  that.socket = null;
                  that.emit('inactive', { sourceName: that.name });
               }
            }
         }
      });
   }

   // publish state changes in this node (casa object) to remote casas
   this.casa.on('state-active', function(_data) {
      if (that.connected) {
         console.log(that.name + ': publishing state ' + _data.sourceName + ' active to peer casa');
         that.unAckedMessages.push( { message: 'state-active', data: _data } );
         that.socket.emit('state-active', _data);
      }
   });

   this.casa.on('state-inactive', function(_data) {
      if (that.connected) {
         console.log(that.name + ': publishing state ' + _data.sourceName + ' inactive to peer casa');
         that.unAckedMessages.push( { message: 'state-inactive', data: _data } );
         that.socket.emit('state-inactive', _data);
      }
   });

   // publish activator changes to remote casas
   this.casa.on('activator-active', function(_data) {
      if (that.connected) {
         console.log(that.name + ': publishing activator ' + _data.sourceName + ' active to peer casa');
         that.unAckedMessages.push( { message: 'activator-active', data: _data } );
         that.socket.emit('activator-active', _data);
      }
   });

   this.casa.on('activator-inactive', function(_data) {
      if (that.connected) {
         console.log(that.name + ': publishing activator ' + _data.sourceName + ' inactive to peer casa');
         that.unAckedMessages.push( { message: 'activator-inactive', data: _data } );
         that.socket.emit('activator-inactive', _data);
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

PeerCasa.prototype.broadcastMessage = function(_message) {

   if (this.connected) {
      console.log(this.name + ': publishing message ' + _message.message + ' orginally from ' + _message.data.sourceName + ' passed on from casa ' + _message.sourceCasa.name);
      this.unAckedMessages.push( { message: _message.message, data: _message.data } );
      this.socket.emit(_message.message, _message.data);
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
      that.unAckedMessages.push( { message: 'login', data: { casaName: that.casa.name } } );
      that.socket.emit('login', { casaName: that.casa.name });
   });

   this.socket.on('loginAACCKK', function(_data) {
      console.log(that.name + ': Login Event ACKed by my peer. Going active.');

      that.unAckedMessages.pop();  // Remove Login

      if (that.unAckedMessages.length > 1) {
         that.resendUnAckedMessages();
      }
      
      that.connected = true;
      that.emit('active', { sourceName: that.name });
   });

   this.socket.on('error', function(_error) {
      console.log(that.name + ': Error received: ' + _error);

      if (that.connected) {
         console.log(that.name + ': Lost connection to my peer. Going inactive.');
         that.connected = false;
         clearInterval(that.intervalID);
         that.intervalID = null;
         that.emit('inactive', { sourceName: that.name });
      }
   });

   this.socket.on('event', function(_data) {
      console.log(that.name + ': Event received: ' + _data);
   });

   this.socket.on('disconnect', function() {
      console.log(that.name + ': Error disconnect');

      if (that.connected) {
         console.log(that.name + ': Lost connection to my peer. Going inactive.');
         that.connected = false;
         clearInterval(that.intervalID);
         that.intervalID = null;
         that.emit('inactive', { sourceName: that.name });
      }
   });
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

PeerCasa.prototype.establishListeners = function(_force) {

   if (!this.listenersSetUp || _force) {
      var that = this;

      // listen for state changes from peer casas
      this.socket.on('state-active', function(_data) {
         console.log(that.name + ': Event received from my peer. Event name: active, state: ' + _data.sourceName);
         that.emit('state-active', _data);
         that.emit('broadcast-message', { message: 'state-active', data:_data, sourceCasa: that });
         that.socket.emit('state-activeAACCKK', _data);
      });

      this.socket.on('state-inactive', function(_data) {
         console.log(that.name + ': Event received from my peer. Event name: inactive, state: ' + _data.sourceName);
         that.emit('state-inactive', _data);
         that.emit('broadcast-message', { message: 'state-inactive', data:_data, sourceCasa: that });
         that.socket.emit('state-inactiveAACCKK', _data);
      });

      // listen for activator changes from peer casas
      this.socket.on('activator-active', function(_data) {
         console.log(that.name + ': Event received from my peer. Event name: active, activator: ' + _data.sourceName);
         that.emit('activator-active', _data);
         that.emit('broadcast-message', { message: 'activator-active', data:_data, sourceCasa: that });
         that.socket.emit('activator-activeAACCKK', _data);
      });

      this.socket.on('activator-inactive', function(_data) {
         console.log(that.name + ': Event received from my peer. Event name: inactive, activator: ' + _data.sourceName);
         that.emit('activator-inactive', _data);
         that.emit('broadcast-message', { message: 'activator-inactive', data:_data, sourceCasa: that });
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
               that.stateRequests[ _resp.requestId] = null;
            });
         } 
         else {
            // TBD Find the casa that ownes the state and work out how to foward the request
            that.emit('forward-request', { message: 'set-state-active-req', data: _data, sourceCasa: that });
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
               that.stateRequests[ _resp.requestId] = null;
            });
         }
         else {
            // TBD Find the casa that ownes the state and work out how to foward the request
            that.emit('forward-request', { message: 'set-state-inactive-req', data: _data, sourceCasa: that });
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
               that.incompleteRequests[_data.requestId] = null;
            }
         }
         else {
            // Find the casa that ownes the original request and work out how to foward the response
            that.emit('forward-response', { message: 'set-state-active-resp', data: _data, sourceCasa: that });
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
               that.incompleteRequests[_data.requestId] = null;
            }
         }
         else {
            // Find the casa that ownes the original request and work out how to foward the response
            that.emit('forward-response', { message: 'set-state-inactive-resp', data: _data, sourceCasa: that });
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
      that.incompleteRequests[_requestId] = null;
   });

}

PeerCasa.prototype.addState = function(_state) {
   // Peer state being added to peer casa
   console.log(this.name + ': State '  +_state.name + ' added to casa ');
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
      var message = { message: 'set-state-active-req', data: { stateName: _state.name, requestId: id, requestor: this.casa.name } };
      this.incompleteRequests[id] = new RemoteCasaRequestor(id, _callback, this.socket);
      this.incompleteRequests[id].sendRequest(message, function(_requestId) {
         console.log(that.name + ': Timeout occurred sending a setActive request for state ' + _state.name);
         delete that.incompleteRequests[_requestId];
         that.incompleteRequests[_requestId] = null;
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
      var message = { message: 'set-state-inactive-req', data: {stateName: _state.name, requestId: id, requestor: this.casa.name } };
      this.incompleteRequests[id] = new RemoteCasaRequestor(id, _callback, this.socket);
      this.incompleteRequests[id].sendRequest(message, function(_requestId) {
         console.log(that.name + ': Timeout occurred sending a setActive request for state ' + _state.name);
         delete that.incompleteRequests[_requestId];
         that.incompleteRequests[_requestId] = null;
      });
   }
   else {
      _callback(false);
   }
}

PeerCasa.prototype.addActivator = function(_activator) {
   // Peer acivator being added to peer casa
   console.log(this.name + ': Activator '  +_activator.name + ' added to casa ');
   this.activators[_activator.name] = _activator;
   console.log(this.name + ': ' + _activator.name + ' associated!');
}

module.exports = exports = PeerCasa;

