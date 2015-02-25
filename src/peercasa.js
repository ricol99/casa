var util = require('util');
var Thing = require('./thing');
var S = require('string');
var io = require('socket.io-client');

function PeerCasa(_name, _displayName, _address, _casa, _casaArea, _proActiveConnect, _props) {

   this.address = null;
   this.casa = null;
   this.proActiveConnect = false;
   this.listenersSetUp = false;

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

   this.incompleteRequests = [];
   this.reqId = 0;

   this.stateRequests = [];

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

           if (!that.connected) {
              that.connected = true;
              that.socket = socket;
              console.log(that.name + ': Connected to my peer. Going active.');

              // listen for state and activator changes from peer casas
              that.establishListeners(true);

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

           if (that.connected) {
              console.log(that.name + ': Lost connection to my peer. Going inactive.');
              that.connected = false;
              clearInterval(that.intervalID);
              that.socket = null;
              that.emit('inactive', that.name);
           }
         }
      });
   }

   // publish state changes to remote casas
   this.casa.on('state-active', function(name) {
      if (that.connected) {
         console.log(that.name + ': publishing state ' + name + ' active to peer casa');
         that.unAckedMessages.push( { message: 'state-active', data: { stateName: name } } );
         that.socket.emit('state-active', { stateName: name });
      }
   });

   this.casa.on('state-inactive', function(name) {
      if (that.connected) {
         console.log(that.name + ': publishing state ' + name + ' inactive to peer casa');
         that.unAckedMessages.push( { message: 'state-inactive', data: { stateName: name } } );
         that.socket.emit('state-inactive', { stateName: name });
      }
   });

   // publish activator changes to remote casas
   this.casa.on('activator-active', function(name) {
      if (that.connected) {
         console.log(that.name + ': publishing activator ' + name + ' active to peer casa');
         that.unAckedMessages.push( { message: 'activator-active', data: { activatorName: name } } );
         that.socket.emit('activator-active', { activatorName: name });
      }
   });

   this.casa.on('activator-inactive', function(name) {
      if (that.connected) {
         console.log(that.name + ': publishing activator ' + name + ' inactive to peer casa');
         that.unAckedMessages.push( { message: 'activator-inactive', data: { activatorName: name } } );
         that.socket.emit('activator-inactive', { activatorName: name });
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
      console.log(that.name + ': Connected to my peer. Logging in...');
      that.establishListeners();
      that.unAckedMessages.push( { message: 'login', data: { name: that.casa.name } } );
      that.socket.emit('login', { name: that.casa.name });
   });

   this.socket.on('loginAACCKK', function(data) {
      console.log(that.name + ': Login Event ACKed by my peer. Going active.');

      that.unAckedMessages.pop();  // Remove Login

      if (that.unAckedMessages.length > 1) {
         that.resendUnAckedMessages();
      }
      
      that.connected = true;
      that.emit('active', that.name);
   });

   this.socket.on('error', function(error) {
      console.log(that.name + ': Error received: ' + error);

      if (that.connected) {
         console.log(that.name + ': Lost connection to my peer. Going inactive.');
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

      if (that.connected) {
         console.log(that.name + ': Lost connection to my peer. Going inactive.');
         that.connected = false;
         clearInterval(that.intervalID);
         that.emit('inactive', that.name);
      }
   });
}

PeerCasa.prototype.establishListeners = function(force) {

   if (!this.listenersSetUp || force) {
      var that = this;

      // listen for state changes from peer casas
      this.socket.on('state-active', function(data) {
         console.log(that.name + ': Event received from my peer. Event name: active, state: ' + data.stateName);
         that.emit('state-active', data.stateName);
         that.socket.emit('state-activeAACCKK', data);
      });

      this.socket.on('state-inactive', function(data) {
         console.log(that.name + ': Event received from my peer. Event name: inactive, state: ' + data.stateName);
         that.emit('state-inactive', data.stateName);
         that.socket.emit('state-inactiveAACCKK', data);
      });

      // listen for activator changes from peer casas
      this.socket.on('activator-active', function(data) {
         console.log(that.name + ': Event received from my peer. Event name: active, activator: ' + data.activatorName);
         that.emit('activator-active', data.activatorName);
         that.socket.emit('activator-activeAACCKK', data);
      });

      this.socket.on('activator-inactive', function(data) {
         console.log(that.name + ': Event received from my peer. Event name: inactive, activator: ' + data.activatorName);
         that.emit('activator-inactive', data.activatorName);
         that.socket.emit('activator-inactiveAACCKK', data);
      });

      this.socket.on('set-state-active-req', function(data) {
         console.log(that.name + ': Event received from my peer. Event name: set-state-active-req, state: ' + data.stateName);
         that.socket.emit('set-state-active-reqAACCKK', data);
         var state = that.casa.findState(data.stateName);

         if (state) {
            this.stateRequests[data.requestId] = function(_requestId, _state, _callback) {
               _state.SetActive(function(resp) {
                  that.socket.emit('set-state-active-resp', { stateName: _state.name, reqId: _requestId, result: resp.result });
                  _callback(_requestId);
               });
            };

            // invoke the function conserving 'this' 
            this.stateRequests[data.requestId].call(this, data.requestId, state, function(_reqId) {
               delete that.stateRequests[_reqId];
               that.stateRequests[_reqId] = null;
            });
         }
      });

      this.socket.on('set-state-inactive-req', function(data) {
         console.log(that.name + ': Event received from my peer. Event name: set-state-inactive-req, state: ' + data.stateName);
         that.socket.emit('set-state-inactive-reqAACCKK', data);
         var state = that.casa.findState(data.stateName);

         if (state) {
            this.stateRequests[data.requestId] = function(_requestId, _state, _callback) {
               _state.SetInactive(function(resp) {
                  that.socket.emit('set-state-inactive-resp', { stateName: _state.name, reqId: _requestId, result: resp.result });
                  _callback(_requestId);
               });
            };

            // invoke the function conserving 'this' 
            this.stateRequests[data.requestId].call(this, data.requestId, state, function(_reqId) {
               delete that.stateRequests[_reqId];
               that.stateRequests[_reqId] = null;
            });
         }
      });

      this.socket.on('set-state-active-resp', function(data) {
         console.log(that.name + ': Event received from my peer. Event name: set-state-active-resp, state: ' + data.stateName);
         that.socket.emit('set-state-active-respAACCKK', data);

         if (that.incompleteRequests[data.requestId]) {
            that.incompleteRequests[data.requestId].callback(data.response);
            delete that.incompleteRequests[data.requestId];
            that.incompleteRequests[data.requestId] = null;
         }
      });

      this.socket.on('set-state-inactive-resp', function(data) {
         console.log(that.name + ': Event received from my peer. Event name: set-state-inactive-resp, state: ' + data.stateName);
         that.socket.emit('set-state-active-respAACCKK', data);

         if (that.incompleteRequests[data.requestId]) {
            that.incompleteRequests[data.requestId].callback(data.response);
            delete that.incompleteRequests[data.requestId];
            that.incompleteRequests[data.requestId] = null;
         }
      });

      this.socket.on('state-activeAACCKK', function(data) {
         console.log(that.name + ': Active Event ACKed by my peer.');
         that.unAckedMessages.shift();
      });

      this.socket.on('state-inactiveAACCKK', function(data) {
         console.log(that.name + ': Inactive Event ACKed by my peer.');
         that.unAckedMessages.shift();
      });

      this.socket.on('activator-activeAACCKK', function(data) {
         console.log(that.name + ': Active Event ACKed by my peer.');
         that.unAckedMessages.shift();
      });

      this.socket.on('activator-inactiveAACCKK', function(data) {
         console.log(that.name + ': Inactive Event ACKed by my peer.');
         that.unAckedMessages.shift();
      });

      this.socket.on('set-state-active-reqAACCKK', function(data) {
         console.log(that.name + ': set state active request event ACKed by my peer. *Not confirmed*');
         that.unAckedMessages.shift();
      });

      this.socket.on('set-state-inactive-reqAACCKK', function(data) {
         console.log(that.name + ': set state inactive request event ACKed by my peer. *Not confirmed*');
         that.unAckedMessages.shift();
      });

      this.socket.on('set-state-active-respAACCKK', function(data) {
         console.log(that.name + ': set state active response event ACKed by my peer.');
         that.unAckedMessages.shift();
      });

      this.socket.on('set-state-inactive-respAACCKK', function(data) {
         console.log(that.name + ': set state inactive response event ACKed by my peer.' );
         that.unAckedMessages.shift();
      });

      this.socket.on('heartbeat', function(data) {
         // do nothing!
         console.log(that.name + ': Heartbeat received');
      });

      // Establish heartbeat
      this.intervalID = setInterval(function(){

         if (that.connected) {
            that.socket.emit('heartbeat', { name: that.casa.name });
         }
      }, 60000);

      this.listenersSetUp = true;
   }
}

PeerCasa.prototype.resendUnAckedMessages = function() {
   var that = this;

   this.unAckedMessages.forEach(function(message) {
      that.socket.emit(message.message, message.data);
   });

}

PeerCasa.prototype.addState = function(_state) {
   // Peer state being added to peer casa
   console.log(this.name + ': State '  +_state.name + ' added to casa ');
   this.states[_state.name] = _state;
   console.log(this.name + ': ' + _state.name + ' associated!');
}

PeerCasa.prototype.setStateActive = function(_state, _callback) {
   console.log(this.name + ': Attempting to set state ' + _state.name + ' to active');

   if (this.connected) {
      console.log(this.name + ': requesting state change to active from peer casa. State ' + _state.name);
      var id = this.name + ':active:' + (this.reqId)++;
      var message = { message: 'set-state-active-req', data: {stateName: _state.name, requestId: id } };
      this.unAckedMessages.push(message);
      this.incompleteRequests[id] =  { message: message, callback: _callback };
      this.socket.emit('set-state-active-req', { stateName: _state.name, requestId: id });
      console.log(this.name + ': Message sent to remote casa');
   }
   else {
      _callback(false);
   }
}

PeerCasa.prototype.setStateInactive = function(_state, _callback) {

   if (this.connected) {
      console.log(this.name + ': requesting state change to inactive from peer casa. State ' + _state.name);
      var id = this.name + ':inactive:' + (this.reqId)++;
      var message = { message: 'set-state-inactive-req', data: {stateName: _state.name, requestId: id } };
      this.unAckedMessages.push(message);
      this.incompleteRequests[id] =  { message: message, callback: _callback };
      this.socket.emit('set-state-inactive-req', { stateName: _state.name, requestId: id });
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

