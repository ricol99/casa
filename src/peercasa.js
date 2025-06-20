var util = require('./util');
var SourceBase = require('./sourcebase');
var S = require('string');
var io = require('socket.io-client');
var Gang = require('./gang');

function PeerCasa(_config, _owner) {
   this.name = _config.name;

   this.gang = Gang.mainInstance();
   this.casa = this.gang.casa;
   this.consoleApiService =  this.gang.casa.findService("consoleapiservice");

   this.secureMode = this.casa.secureMode;
   this.certPath = this.casa.certPath;
   this.persistent = false;
   this.proActiveConnect = false;

   this.deathTime = 500;

   SourceBase.call(this, { name: ( _config.hasOwnProperty('name')) ? _config.name : _config.code + "-" + _config.name,
                           type: "peercasa", transient: true }, _owner);

   this.sources = [];

   this.listenersSetUp = false;
   this.casaListeners = [];

   this.connected = false;
   this.socket = null;
   this.intervalId = null;

   this.incompleteRequests = [];
   this.reqId = 0;

   this.lastHeartbeat = Date.now() + 10000;
   this.manualDisconnect = false;
   this.waitingToConnect = false;

   this.topSources = {};
   this.bowingSources = {};

   // Callbacks for listening to main casa
   this.sourcePropertyChangedCasaHandler = PeerCasa.prototype.sourcePropertyChangedCasaCb.bind(this);
   this.sourceEventRaisedCasaHandler = PeerCasa.prototype.sourceEventRaisedCasaCb.bind(this);
   this.sourceAddedCasaHandler = PeerCasa.prototype.sourceAddedCasaCb.bind(this);
   this.sourceRemovedCasaHandler = PeerCasa.prototype.sourceRemovedCasaCb.bind(this);

   // publish source changes in this node (casa object) to peer casas
   this.casa.on('source-property-changed', this.sourcePropertyChangedCasaHandler);
   this.casa.on('source-event-raised', this.sourceEventRaisedCasaHandler);
   this.casa.on('source-added', this.sourceAddedCasaHandler);
   this.casa.on('source-removed', this.sourceRemovedCasaHandler);

   this.ensurePropertyExists('ACTIVE', 'property', { initialValue: false }, _config);
}

util.inherits(PeerCasa, SourceBase);

// Used to classify the type and understand where to load the javascript module
PeerCasa.prototype.superType = function(_type) {
   return "peercasa";
};

PeerCasa.prototype.coldStart = function() {
   SourceBase.prototype.coldStart.call(this);

   for (var source in this.sources) {

      if (this.sources.hasOwnProperty(source)){
         console.log(this.uName + ': Cold starting peer source ' + this.sources[source].uName);
         this.sources[source].coldStart();
      }
   }
};

PeerCasa.prototype.sourcePropertyChangedCasaCb = function(_data) {

   if (this.connected && (_data.sourcePeerCasa != this.uName)) {

      if (!(_data.hasOwnProperty("local") && _data.local)) {
         console.log(this.uName + ': publishing source ' + _data.sourceName + ' property-changed to peer casa');
         this.sendMessage('source-property-changed', _data);
      }
   }
};

PeerCasa.prototype.sourceEventRaisedCasaCb = function(_data) {

   if (this.connected && (_data.sourcePeerCasa != this.uName)) {

      if (!(_data.hasOwnProperty("local") && _data.local)) {
         console.log(this.uName + ': publishing source ' + _data.sourceName + ' event-raised to peer casa');
         this.sendMessage('source-event-raised', _data);
      }
   }
};

PeerCasa.prototype.sourceAddedCasaCb = function(_data) {

   if (this.connected && (_data.sourcePeerCasa != this.uName)) {

      if (!_data.local) {
         console.log(this.uName + ': publishing source ' + _data.sourceName + ' added to peer casa');
         var source = this.casa.getSource(_data.sourceName);
         var allProps = {};
         source.getAllProperties(allProps, true);
         source.getAllEvents(allEvents, true);
         _data.sourceName = source.name;
         _data.sourcePriority = (source.hasOwnProperty('priority')) ? source.priority : 0;
         _data.sourceProperties = util.copy(allProps);
         _data.sourceEvents = util.copy(allEvents);
         this.sendMessage('source-added', _data);
      }
      else {
         console.log(this.uName + ': not publishing source ' + _data.sourceName + ' added to peer casa - Not Global');
      }
   }
};

PeerCasa.prototype.sourceRemovedCasaCb = function(_data) {

   if (this.connected && (_data.sourcePeerCasa != this.uName)) {

      if (!_data.local) {
         console.log(this.uName + ': publishing source ' + _data.sourceName + ' removed from peer casa');
         this.sendMessage('source-removed', _data);
      }
      else {
         console.log(this.uName + ': not publishing source ' + _data.sourceName + ' removed from peer casa - Not Global');
      }
   }
};

PeerCasa.prototype.removeCasaListeners = function() {
   console.log(this.uName + ': removing casa listeners');

   if (!this.persistent) {
      this.casa.removeListener('source-property-changed', this.sourcePropertyChangedCasaHandler);
      this.casa.removeListener('source-event-raised', this.sourceEventRaisedCasaHandler);
      this.casa.removeListener('source-added', this.sourceAddedCasaHandler);
      this.casa.removeListener('source-removed', this.sourceRemovedCasaHandler);
   }
}

PeerCasa.prototype.invalidate = function() {
   var previousFullName = "ZZZZZZ";

   for (var source in this.sources) {

      if (this.sources.hasOwnProperty(source) && !source.startsWith(previousFullName)) {
         this.sources[source].findNewMainSource();
         this.sources[source].invalidate(true);
         delete this.sources[source];
         previousFullName = source;
      }
   }

   delete this.sources;
   this.sources = [];

   this.properties['ACTIVE'].invalidate(false);
   this.gang.casa.refreshSourceListeners();
}

PeerCasa.prototype.getHostname = function() {
   return this.address.hostname;
};

PeerCasa.prototype.getPort = function() {
   return this.address.port;
};

PeerCasa.prototype.serveClient = function(_socket) {
   console.log(this.uName + ': I am connected to my peer. Socket: ' + _socket);

   this.connected = true;
   this.socket = _socket;
   this.establishListeners();

   this.loginTimer = setTimeout( () => {
      console.info(this.uName + ': rejecting login from anonymous casa. Timed out!');
      this.socket.disconnect();
      this.manualDisconnect = true;
      this.deleteMeIfNeeded();
   }, 20000);

   console.log(this.uName + ': Connected to my peer. Waiting for login.');
};

PeerCasa.prototype.disconnectFromClient = function() {

   if (this.connected) {
      this.socket.disconnect();
      this.manualDisconnect = true;
      this.deleteMeIfNeeded();
   }
};

PeerCasa.prototype.socketLoginCb = function(_config) {
   console.log(this.uName + ': login: ' + _config.casaName);

   if (_config.casaVersion && _config.casaVersion < parseFloat(this.gang.version)) {
      console.info(this.uName + ': rejecting login from casa' + _config.casaName + '. Version mismatch!');
      this.socket.emit('loginRREEJJ', { casaName: this.casa.uName, reason: "version-mismatch" });
      this.disconnectFromClient();
      return;
   }

   console.log("PeerCasa.prototype.socketLoginCb() config=", _config);
   this.config = util.copy(_config, true);
   this.changeName(this.config.casaName.substr(2));	// XXX HACK
   this.createSources(this.config, this);

   clearTimeout(this.loginTimer);
   this.loginTimer = null;

   var simpleConfig = this.casa.refreshSimpleConfig();

   // Cold start Peer Casa and all the peers sources now that everything has been created
   this.coldStart();
   this.sendMessage('loginAACCKK', { gangHash: this.gang.gangDb.getHash(), casaName: this.casa.uName, casaConfig: simpleConfig });
   this.establishHeartbeat();

   this.resendIncompleteRequests();
   this.alignPropertyValue('ACTIVE', true, { sourceName: this.uName });
};

PeerCasa.prototype.connectToPeerCasa = function(_config) {
   this.proActiveConnect = true;

   if (_config) {
      this.loginAs = _config.hasOwnProperty('loginAs') ? _config.loginAs : 'peer';
      this.persistent = (_config.hasOwnProperty('persistent')) ? _config.persistent : false;
      this.address = _config.address;
      this.messageTransport = _config.messageTransport;
      this.discoveryTier = _config.discoveryTier;
   }
/*
   this.socket = io(this.http + '://' + this.address.host + ':' + this.address.port + '/peercasa', this.socketOptions);
*/
   console.log(this.uName + ': Attempting to connect to peer casa at ' + util.inspect(this.address) + " over " + this.messageTransport);
   this.socket = this.casa.mainWebService.newIoSocket(this.address, "/peercasa", this.secureMode, this.messageTransport);
   this.establishListeners();
};

PeerCasa.prototype.deleteSocket = function() {

   if (this.listenersSetUp)  {
      this.listenersSetUp = false;

      if (this.proActiveConnect) {
         this.socket.removeListener('connect', this.socketConnectHandler);
         this.socket.removeListener('loginAACCKK', this.socketLoginSuccessHandler);
         this.socket.removeListener('loginRREEJJ', this.socketLoginFailureHandler);
      }
      else {
         this.socket.removeListener('login', this.socketLoginHandler);
      }

      this.socket.removeListener('error', this.socketErrorHandler);
      this.socket.removeListener('connect_error', this.socketErrorHandler);
      this.socket.removeListener('connect_timeout', this.socketErrorHandler);
      this.socket.removeListener('disconnect', this.socketDisconnectHandler);
      this.socket.removeListener('casa-active', this.socketCasaActiveHandler);
      this.socket.removeListener('casa-inactive', this.socketCasaInactiveHandler);
      this.socket.removeListener('source-property-changed', this.socketSourcePropertyChangedHandler);
      this.socket.removeListener('source-subscription-registered', this.socketSourceSubscriptionRegisteredHandler);
      this.socket.removeListener('source-subscription-removed', this.socketSourceSubscriptionRemovedHandler);
      this.socket.removeListener('source-interest-in-new-child', this.socketSourceInterestInNewChildHandler);
      this.socket.removeListener('source-event-raised', this.socketSourceEventRaisedHandler);
      this.socket.removeListener('source-added', this.socketSourceAddedHandler);
      this.socket.removeListener('source-removed', this.socketSourceRemovedHandler);
      this.socket.removeListener('console-command', this.socketConsoleCommandHandler);
      this.socket.removeListener('set-source-transaction-req', this.socketSetSourceTransactionReqHandler);
      this.socket.removeListener('set-source-property-req', this.socketSetSourcePropertyReqHandler);
      this.socket.removeListener('raise-source-event-req', this.socketRaiseSourceEventReqHandler);
      this.socket.removeListener('set-source-transaction-resp', this.socketSetSourceTransactionRespHandler);
      this.socket.removeListener('set-source-property-resp', this.socketSetSourcePropertyRespHandler);
      this.socket.removeListener('raise-source-event-resp', this.socketRaiseSourceEventRespHandler);
      this.socket.removeListener('heartbeat', this.socketHeartbeatHandler);
   }

   delete this.socket;
   this.socket = null;
};

//=================
// Socket Callbacks
//=================
PeerCasa.prototype.socketConnectCb = function() {
   console.log(this.uName + ': Connected to my peer. Logging in...');

   var simpleConfig = this.casa.refreshSimpleConfig();

   var messageData = {
      casaName: this.casa.uName,
      casaType: this.loginAs,
      casaConfig: simpleConfig,
      casaVersion: this.gang.version
   };

   this.sendMessage('login', messageData);

   this.loginTimer = setTimeout( () => {
      console.info(this.uName + ': giving up on login with casa' + this.uName + '. Timed out!');
      this.manualDisconnect = true;
      this.socket.disconnect();
      this.deleteMeIfNeeded();
   }, 20000);

};

PeerCasa.prototype.socketLoginSuccessCb = function(_data) {
   console.log(this.uName + ': Login Event ACKed by my peer. Going active.');

   clearTimeout(this.loginTimer);
   this.loginTimer = null;

   if (this.uName !== _data.casaName) {
      console.log(this.uName + ': Casa name mismatch! Aligning client peer casa name to server name ('+_data.casaName+')');
      this.gang.removePeerCasa(this);
      this.gang.changePeerCasaName(this, _data.casaName);
      this.changeName(_data.casaName.substr(2));	// XXX HACK
      this.gang.addPeerCasa(this);
   }

   this.resendIncompleteRequests();
   this.connected = true;
   this.createSources(_data, this);

   // Cold start Peer Casa and all the peers sources now that everything has been created
   this.coldStart();

   this.establishHeartbeat();

   this.alignPropertyValue('ACTIVE', true, { sourceName: this.uName });
};

PeerCasa.prototype.socketLoginFailureCb = function(_data) {
   console.info(this.uName + ': Login Event REJed by my peer. Exiting.');
   process.exit(2);
};

PeerCasa.prototype.socketErrorCb = function(_error) {
   console.log(this.uName + ': Error received: ' + _error);

   if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
   }

   if (this.connected) {
      console.log(this.uName + ': Lost connection to my peer. Going inactive.');
      this.connected = false;
      this.removeCasaListeners();
      this.invalidate();

      if (this.socket) {
         this.socket.disconnect();
      }
   }
   else {
      this.deleteMeIfNeeded();
   }
};

PeerCasa.prototype.socketDisconnectCb = function(_data) {
   console.log(this.uName + ': Error disconnect');

   if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
   }

   if (this.connected) {
      console.log(this.uName + ': Lost connection to my peer. Going inactive.');
      this.connected = false;
      this.removeCasaListeners();
      this.invalidate();
   }

   this.manualDisconnect = true;

   //if (this.socket) {
      //this.socket.disconnect();
   //}
   this.deleteMeIfNeeded();
};

PeerCasa.prototype.socketCasaActiveCb = function(_data) {
   console.log(this.uName + ': Event received from my peer. Event name: casa-active, casa: ' + _data.sourceName);
   this.emit('casa-active', _data);
};

PeerCasa.prototype.socketCasaInactiveCb = function(_data) {
   console.log(this.uName + ': Event received from my peer. Event name: casa-inactive, casa: ' + _data.sourceName);
   this.emit('casa-inactive', _data);
};

PeerCasa.prototype.socketSourceSubscriptionRegisteredCb = function(_data) {
   console.log(this.uName + ': Event received from my peer. Event name: subscription-registered, source: ' + _data.sourceName);

   if (this.casa.sources[_data.sourceName]) {
      this.casa.sources[_data.sourceName].subscriptionRegistered(_data.event, _data.subscription);
   }
};

PeerCasa.prototype.socketSourceSubscriptionRemovedCb = function(_data) {
   console.log(this.uName + ': Event received from my peer. Event name: subscription-removed, source: ' + _data.sourceName);

   if (this.casa.sources[_data.sourceName]) {
      this.casa.sources[_data.sourceName].subscriptionRemoved(_data.event, _data.subscription);
   }
};

PeerCasa.prototype.socketSourceInterestInNewChildCb = function(_data) {
   console.log(this.uName + ': Event received from my peer. Event name: interest-in-new-child, source: ' + _data.sourceName);

   if (this.casa.sources[_data.sourceName]) {
      this.casa.sources[_data.sourceName].interestInNewChild(_data.uName);
   }
};

PeerCasa.prototype.socketSourcePropertyChangedCb = function(_data) {
   console.log(this.uName + ': Event received from my peer. Event name: property-changed, source: ' + _data.sourceName);
   this.emit('source-property-changed', _data);

   if (this.sources[_data.sourceName]) {
      _data.sourcePeerCasa = this.uName;
      this.sources[_data.sourceName].sourceHasChangedProperty(_data);
   }
};

PeerCasa.prototype.socketSourceEventRaisedCb = function(_data) {
   console.log(this.uName + ': Event received from my peer. Event name: event-raised, source: ' + _data.sourceName);
   this.emit('source-event-raised', _data);

   if (this.sources[_data.sourceName]) {
      _data.sourcePeerCasa = this.uName;
      this.sources[_data.sourceName].sourceHasRaisedEvent(_data);
   }
};

PeerCasa.prototype.socketSourceAddedCb = function(_data) {
   console.log(this.uName + ': Event received from my peer. Event name: source-added, source: ' + _data.sourceName);

   var PeerSource = require('./peersource');
   console.log(this.uName + ': Creating peer source named ' + _data.sourceName + ' priority =' + _data.sourcePriority);
   var source = new PeerSource(_data.sourceName, _data.sourceName, _data.sourcePriority, _data.sourceProperties, _data.sourceEvents, this);

   // Refresh all inactive sources
   this.gang.casa.refreshSourceListeners();
};

PeerCasa.prototype.socketSourceRemovedCb = function(_data) {
   console.log(this.uName + ': Event received from my peer. Event name: source-removed, source: ' + _data.sourceName);

   if (this.sources.hasOwnProperty(_data.sourceName)) {
      this.sources[_data.sourceName].invalidate(true);
      delete this.sources[_data.sourceName];
   }
};

PeerCasa.prototype.socketConsoleCommandCb = function(_data) {
   console.log(this.uName + ': Event received from my peer. Event name: console-command, source: ' + _data.sourceName);

   if (_data.hasOwnProperty("scope") && _data.hasOwnProperty("line")) {
      this.consoleApiService.executeCommand({ scope: _data.scope, line: _data.line });
   }
};

PeerCasa.prototype.socketSetSourceTransactionReqCb = function(_data) {
   console.log(this.uName + ': Event received from my peer. Event name: set-source-transaction-req, source: ' + _data.sourceName);
   var source = this.gang.findNamedObject(_data.sourceName);
      
   if (source) {
      let ret = _data.hasOwnProperty("newTransaction");

      if (ret) {
         var trans = source.setTransaction(_data.newTransaction);
      }
      this.socket.emit('set-source-transaction-resp', { sourceName: source.uName, requestId: _data.requestId, result: ret, newTransaction: _data.newTransaction, requestor: _data.requestor });
   }  
   else {
      // TBD Find the casa that ownes the source and work out how to foward the request
      this.emit('forward-request', { message: 'set-source-transaction-req', data: _data, sourceCasa: this.uName });
   }  
};
      
PeerCasa.prototype.socketSetSourcePropertyReqCb = function(_data) {
   console.log(this.uName + ': Event received from my peer. Event name: set-source-property-req, source: ' + _data.sourceName);
   var source = this.gang.findNamedObject(_data.sourceName);

   if (source) {

      var res;

      if (_data.hasOwnProperty('ramp')) {
         res = source.setPropertyWithRamp(_data.property, _data.ramp, _data);
         this.socket.emit('set-source-property-resp', { sourceName: source.uName, requestId: _data.requestId, result: res, property: _data.property, ramp: _data.ramp, requestor: _data.requestor });
      }
      else {
         res = source.setProperty(_data.property, _data.value, _data);
         this.socket.emit('set-source-property-resp', { sourceName: source.uName, requestId: _data.requestId, result: res, property: _data.property, value: _data.value, requestor: _data.requestor });
      }

   } 
   else {
      // TBD Find the casa that ownes the source and work out how to foward the request
      this.emit('forward-request', { message: 'set-source-property-req', data: _data, sourceCasa: this.uName });
   }
};

PeerCasa.prototype.socketRaiseSourceEventReqCb = function(_data) {
   console.log(this.uName + ': Event received from my peer. Event name: raise-source-event-req, source: ' + _data.sourceName);
   var source = this.gang.findNamedObject(_data.sourceName);
      
   if (source) {
      source.raiseEvent(_data.eventName, _data);
   }  
   else {
      // TBD Find the casa that ownes the source and work out how to foward the request
      this.emit('forward-request', { message: 'raise-source-event-req', data: _data, sourceCasa: this.uName });
   }  
};    
 
PeerCasa.prototype.socketSetSourceTransactionRespCb = function(_data) {
   console.log(this.uName + ': Event received from my peer. Event name: set-source-transaction-resp, source: ' + _data.sourceName);

   if (_data.requestor == this.casa.uName) {

      if (this.incompleteRequests[_data.requestId]) {
         this.incompleteRequests[_data.requestId].completeRequest(_data.result);
         delete this.incompleteRequests[_data.requestId];
      }
   }
   else {
      // Find the casa that ownes the original request and work out how to foward the response
      this.emit('forward-response', { message: 'set-source-transaction-resp', data: _data, sourceCasa: this.uName });
   }
};

PeerCasa.prototype.socketSetSourcePropertyRespCb = function(_data) {
   console.log(this.uName + ': Event received from my peer. Event name: set-source-property-resp, source: ' + _data.sourceName);

   if (_data.requestor == this.casa.uName) {

      if (this.incompleteRequests[_data.requestId]) {
         this.incompleteRequests[_data.requestId].completeRequest(_data.result);
         delete this.incompleteRequests[_data.requestId];
      }
   }
   else {
      // Find the casa that ownes the original request and work out how to foward the response
      this.emit('forward-response', { message: 'set-source-property-resp', data: _data, sourceCasa: this.uName });
   }
};

PeerCasa.prototype.socketRaiseSourceEventRespCb = function(_data) {
   console.log(this.uName + ': Event received from my peer. Event name: raise-source-event-resp, source: ' + _data.sourceName);
      
   if (_data.requestor == this.casa.uName) {

      if (this.incompleteRequests[_data.requestId]) {
         this.incompleteRequests[_data.requestId].completeRequest(_data.result);
         delete this.incompleteRequests[_data.requestId];
      }
   }  
   else {
      // Find the casa that ownes the original request and work out how to foward the response
      this.emit('forward-response', { message: 'raise-source-event-resp', data: _data, sourceCasa: this.uName });
   }  
};

PeerCasa.prototype.socketHeartbeatCb = function(_data) {
   console.log(this.uName + ': Heartbeat received');

   this.lastHeartbeat = Date.now();
};
//========================
// End of socket callbacks
//========================

PeerCasa.prototype.deleteMeIfNeeded = function() {

   if (this.loginTimer) {
      clearTimeout(this.loginTimer);
      this.loginTimer = null;
   }

   if (this.persistent) {   // Must be proActiveConnect - ie a client

      if (!this.waitingToConnect) {
         this.waitingToConnect = true;
         this.alignPropertyValue('ACTIVE', false, { sourceName: this.uName });

         if (this.manualDisconnect) {
            // Recreate socket to attempt reconnection
            this.manualDisconnect = false;
         }

         console.log(this.uName + ': Attempting to re-establish connection after manual disconnection');
         this.deleteSocket();

         setTimeout( () => {
            this.waitingToConnect = false;
            this.connectToPeerCasa();
         }, 10000);
      }
   }
   else {

      if (this.socket) {

         if (!this.manualDisconnect) {
            this.socket.disconnect();
         }

         this.deleteSocket();
      }

      console.log(this.uName + ': Deleting non-persistent Peercasa object - using death timer');
      this.gang.removePeerCasa(this);

      setTimeout( () => {

         if (!this.connected) {
            console.log(this.uName + ': Peercasa object has been deleted - cleanup complete');
            delete this;
         }
      }, this.deathTime);
   }
}

PeerCasa.prototype.refreshSimpleConfig = function() {

   for (var j = 0; j < this.config.sources.length; ++j) {
      var allProps = {};
      var properties = this.sources[this.config.sources[j].uName].properties;

      for (var name in properties) {

         if (properties.hasOwnProperty(name)) {
            allProps[name] = properties[name].value;
         }
      }

      delete this.config.sources[j].properties;
      this.config.sources[j].properties = util.copy(allProps);

      var allEvents = {};
      var events = this.sources[this.config.sources[j].uName].events;
      
      for (var eventName in events) {
      
         if (events.hasOwnProperty(eventName)) {
            allEvents[eventName] = true;
         }
      }
   
      delete this.config.sources[j].events; 
      this.config.sources[j].events = util.copy(allEvents);
   }

   return this.config;
}

PeerCasa.prototype.createSources = function(_data, _peerCasa) {

   if (_data.casaConfig &&  _data.casaConfig.sources) {
      var len = _data.casaConfig.sources.length;
      console.log(_peerCasa.uName + ': New sources found = ' + len);

      _data.casaConfig.sources.sort( (_a, _b) => {
          return (_a.uName > _b.uName) ? 1 : (_a.uName < _b.uName) ? -1 : 0;
      });

      var PeerSource = require('./peersource');

      for (var i = 0; i < len; ++i) {
         console.log(_peerCasa.uName + ': Creating peer source named ' + _data.casaConfig.sources[i].uName + ' name = ' + _data.casaConfig.sources[i].name +
                                          ' priority =' + _data.casaConfig.sources[i].priority);
         var source = new PeerSource(_data.casaConfig.sources[i].uName, _data.casaConfig.sources[i].name, _data.casaConfig.sources[i].priority,
                                     _data.casaConfig.sources[i].properties, _data.casaConfig.sources[i].events, _peerCasa);
      }
   }

   // Refresh all inactive sources
   this.gang.casa.refreshSourceListeners();
}

PeerCasa.prototype.isActive = function() {
   return this.connected;
}

PeerCasa.prototype.establishListeners = function(_force) {

   if (!this.listenersSetUp || _force) {

      if (this.proActiveConnect) {
         this.socketConnectHandler = PeerCasa.prototype.socketConnectCb.bind(this);
         this.socketLoginSuccessHandler = PeerCasa.prototype.socketLoginSuccessCb.bind(this);
         this.socketLoginFailureHandler = PeerCasa.prototype.socketLoginFailureCb.bind(this);

         this.socket.on('connect', this.socketConnectHandler);
         this.socket.on('loginAACCKK', this.socketLoginSuccessHandler);
         this.socket.on('loginRREEJJ', this.socketLoginFailureHandler);
      }
      else {
         this.socketLoginHandler = PeerCasa.prototype.socketLoginCb.bind(this);
         this.socket.on('login', this.socketLoginHandler);
      }

      this.socketErrorHandler = PeerCasa.prototype.socketErrorCb.bind(this);
      this.socketDisconnectHandler = PeerCasa.prototype.socketDisconnectCb.bind(this);
      this.socketCasaActiveHandler = PeerCasa.prototype.socketCasaActiveCb.bind(this);
      this.socketCasaInactiveHandler = PeerCasa.prototype.socketCasaInactiveCb.bind(this);
      this.socketSourcePropertyChangedHandler = PeerCasa.prototype.socketSourcePropertyChangedCb.bind(this);
      this.socketSourceSubscriptionRegisteredHandler = PeerCasa.prototype.socketSourceSubscriptionRegisteredCb.bind(this);
      this.socketSourceSubscriptionRemovedHandler = PeerCasa.prototype.socketSourceSubscriptionRemovedCb.bind(this);
      this.socketSourceInterestInNewChildHandler = PeerCasa.prototype.socketSourceInterestInNewChildCb.bind(this);
      this.socketSourceEventRaisedHandler = PeerCasa.prototype.socketSourceEventRaisedCb.bind(this);
      this.socketSourceAddedHandler = PeerCasa.prototype.socketSourceAddedCb.bind(this);
      this.socketSourceRemovedHandler = PeerCasa.prototype.socketSourceRemovedCb.bind(this);
      this.socketConsoleCommandHandler = PeerCasa.prototype.socketConsoleCommandCb.bind(this);
      this.socketSetSourceTransactionReqHandler = PeerCasa.prototype.socketSetSourceTransactionReqCb.bind(this);
      this.socketSetSourcePropertyReqHandler = PeerCasa.prototype.socketSetSourcePropertyReqCb.bind(this);
      this.socketRaiseSourceEventReqHandler = PeerCasa.prototype.socketRaiseSourceEventReqCb.bind(this);
      this.socketSetSourceTransactionRespHandler = PeerCasa.prototype.socketSetSourceTransactionRespCb.bind(this);
      this.socketSetSourcePropertyRespHandler = PeerCasa.prototype.socketSetSourcePropertyRespCb.bind(this);
      this.socketRaiseSourceEventRespHandler = PeerCasa.prototype.socketRaiseSourceEventRespCb.bind(this);
      this.socketHeartbeatHandler = PeerCasa.prototype.socketHeartbeatCb.bind(this);

      this.socket.on('error', this.socketErrorHandler);
      this.socket.on('connect_error', this.socketErrorHandler);
      this.socket.on('connect_timeout', this.socketErrorHandler);
      this.socket.on('disconnect', this.socketDisconnectHandler);
      this.socket.on('casa-active', this.socketCasaActiveHandler);
      this.socket.on('casa-inactive', this.socketCasaInactiveHandler);
      this.socket.on('source-property-changed', this.socketSourcePropertyChangedHandler);
      this.socket.on('source-subscription-registered', this.socketSourceSubscriptionRegisteredHandler);
      this.socket.on('source-subscription-removed', this.socketSourceSubscriptionRemovedHandler);
      this.socket.on('source-interest-in-new-child', this.socketSourceInterestInNewChildHandler);
      this.socket.on('source-event-raised', this.socketSourceEventRaisedHandler);
      this.socket.on('source-added', this.socketSourceAddedHandler);
      this.socket.on('source-removed', this.socketSourceRemovedHandler);
      this.socket.on('console-command', this.socketConsoleCommandHandler);
      this.socket.on('set-source-transaction-req', this.socketSetSourceTransactionReqHandler);
      this.socket.on('set-source-property-req', this.socketSetSourcePropertyReqHandler);
      this.socket.on('raise-source-event-req', this.socketRaiseSourceEventReqHandler);
      this.socket.on('set-source-transaction-resp', this.socketSetSourceTransactionRespHandler);
      this.socket.on('set-source-property-resp', this.socketSetSourcePropertyRespHandler);
      this.socket.on('raise-source-event-resp', this.socketRaiseSourceEventRespHandler);
      this.socket.on('heartbeat', this.socketHeartbeatHandler);

      this.listenersSetUp = true;
   }
}

PeerCasa.prototype.establishHeartbeat = function() {
   this.lastHeartbeat = Date.now() + 10000;

   if (!this.intervalId) {

      // Establish heartbeat
      this.intervalId = setInterval( () => {

         if (this.connected) {

            // Check if we have received a heartbeat from the other side recently
            if ((Date.now() - this.lastHeartbeat) > 120000) {
               console.log(this.uName + ': No heartbeat received for two times the interval!. Closing socket.');
               this.manualDisconnect = true;
               this.socket.disconnect();
               this.deleteMeIfNeeded();
            }
            else {
               console.log(this.uName + ': Last heartbeat time difference = ', Date.now() - this.lastHeartbeat);
               this.socket.emit('heartbeat', { casaName: this.casa.uName });
            }
         }
      }, 60000);
   }
}

PeerCasa.prototype.sendMessage = function(_message, _data) {
   this.socket.emit(_message, _data);
}

PeerCasa.prototype.resendIncompleteRequests = function() {

   var toDelete = [];
   for(var prop in this.incompleteRequests) {

      if (this.incompleteRequests.hasOwnProperty(prop)){

         this.incompleteRequests[prop].resendRequest( (_requestId) => {
            toDelete.push(_requestId);
         });
      }
   }

   // Clean up any already acked messages
   toDelete.forEach( (_requestId) => {
      delete this.incompleteRequests[_requestId];
   });

}

function PeerCasaRequestor(_requestId, _callback, _socket) {
   this.requestId = _requestId;
   this.callback = _callback;
   this.socket = _socket;
   this.timeout = null;
   this.message = null;;
}

PeerCasaRequestor.prototype.sendRequest = function(_message, _deleteMe) {
   this.message = _message;
   this.socket.emit(this.message.message, this.message.data);

   this.timeout = setTimeout( () => {
      this.callback("timeout");
      _deleteMe(this.requestId);
   }, 30000);
}

PeerCasaRequestor.prototype.resendRequest = function(_deleteMe) {

   if (this.timeout) {
      clearTimeout(this.timeout);
   }

   this.socket.emit(this.message.message, this.message.data);

   this.timeout = setTimeout( () => {
      this.callback("tiemout");
      _deleteMe(this.requestId);
   }, 30000);
}

PeerCasaRequestor.prototype.completeRequest = function(_result) {
   clearTimeout(this.timeout);
   this.callback(null, _result);
}

PeerCasa.prototype.subscriptionRegistered = function(_source, _event, _subscription) {

   if (this.connected) {
      console.log(this.uName + ': source ' + _source.uName + ' subscribed to');
      this.sendMessage('source-subscription-registered', { sourceName: _source.uName, event: _event, subscription: _subscription });
   }
};

PeerCasa.prototype.subscriptionRemoved = function(_source, _event, _subscription) {

   if (this.connected) {
      console.log(this.uName + ': source ' + _source.uName + ' subscribed to');
      this.sendMessage('source-subscription-removed', { sourceName: _source.uName, event: _event, subscription: _subscription });
   }
};

PeerCasa.prototype.interestInNewChild = function(_source, _uName) {

   if (this.connected) {
      console.log(this.uName + ': source ' + _source.uName + ' interested in new child " + _uName + " being created');
      this.sendMessage('source-interest-in-new-child', { sourceName: _source.uName, uName: _uName });
   }
};

PeerCasa.prototype.setSourceActive = function(_source, _data, _callback) {
   this.setSourceProperty(_source, "ACTIVE", true, _data, _callback);
}

PeerCasa.prototype.setSourceInactive = function(_source, _data, _callback) {
   this.setSourceProperty(_source, "ACTIVE", false, _data, _callback);
}

PeerCasa.prototype.setSourceTransaction = function(_source, _newTransaction, _data) {

   if (this.connected) {
      console.log(this.uName + ': setting new transaction to peer casa. Source=' + _source.uName);
      var id = this.uName + ':settrans:' + this.reqId;
      this.reqId = (this.reqId +  1) % 10000;
      var message = { message: 'set-source-transaction-req', data: { casaName: this.uName, sourceName: _source.uName, newTransaction: _newTransaction,
                                                                     requestId: id, requestor: this.casa.uName, transaction: _data.transaction } };

      this.incompleteRequests[id] = new PeerCasaRequestor(id, (_err, _res) => {

         if (_err) {
            console.error(this.uName + ': Unable to set new transaction request to source ' + _source.uName + ' at peer casa, error=' + _err);
         }
         else {
            console.log(this.uName + ': New transaction request to source ' + _source.uName + ' at peer casa, result=' + _res);
         }
      }, this.socket);

      this.incompleteRequests[id].sendRequest(message, (_requestId) => {
         console.log(this.uName + ': Timeout occurred sending a changeProperty request for source ' + _source.uName);
         delete this.incompleteRequests[_requestId];
      });

      return true;
   }
   else {
      return false;
   }
};

PeerCasa.prototype.setSourceProperty = function(_source, _propName, _propValue, _data) {

   if (this.connected) {
      console.log(this.uName + ': requesting source change property ' + _propName + ' to ' + _propValue + ' from peer casa. Source ' + _source.uName);
      var id = this.uName + ':changeprop:' + this.reqId;
      this.reqId = (this.reqId +  1) % 10000;
      var message = { message: 'set-source-property-req', data: { casaName: this.uName, sourceName: _source.uName,
                                                                  property: _propName, value: _propValue,
                                                                  requestId: id, requestor: this.casa.uName, transaction: _data.transaction } };

      this.incompleteRequests[id] = new PeerCasaRequestor(id, (_err, _res) => {

         if (_err) {
            console.error(this.uName + ': Unable to send SetProperty request to source ' + _source.uName + ' at peer casa, error=' + _err);
         }
         else {
            console.log(this.uName + ': SetProperty request to source ' + _source.uName + ' at peer casa, result=' + _res);
         }
      }, this.socket);

      this.incompleteRequests[id].sendRequest(message, (_requestId) => {
         console.log(this.uName + ': Timeout occurred sending a changeProperty request for source ' + _source.uName);
         delete this.incompleteRequests[_requestId];
      });

      return true;
   }
   else {
      return false;
   }
}

PeerCasa.prototype.setSourcePropertyWithRamp = function(_source, _propName, _ramp, _data) {

   if (this.connected) {
      console.log(this.uName + ': requesting source change property ' + _propName + ' to ' + _propValue + ' from peer casa. Source ' + _source.uName);
      var id = this.uName + ':changeprop:' + this.reqId;
      this.reqId = (this.reqId +  1) % 10000;
      var message = { message: 'set-source-property-req', data: { casaName: this.uName, sourceName: _source.uName,
                                                                  property: _propName, ramp: _ramp,
                                                                  requestId: id, requestor: this.casa.uName, transaction: _data.transaction } };

      this.incompleteRequests[id] = new PeerCasaRequestor(id, (_err, _res) => {
         console.log(this.uName + ': Unable to send SetProperty request to source ' + _source.uName + ' at peer casa ');
      }, this.socket);

      this.incompleteRequests[id].sendRequest(message, (_requestId) => {
         console.log(this.uName + ': Timeout occurred sending a changeProperty request for source ' + _source.uName);
         delete this.incompleteRequests[_requestId];
      });

      return true;
   }
   else {
      return false;
   }
}

PeerCasa.prototype.raiseSourceEvent = function(_source, _eventName, _data) {

   if (this.connected) {
      console.log(this.uName + ': requesting source raise event' + _eventName + ' from peer casa. Source ' + _source.uName);
      var id = this.uName + ':raiseevent:' + this.reqId;
      this.reqId = (this.reqId +  1) % 10000;
      var message = { message: 'raise-source-event-req', data: { casaName: this.uName, sourceName: _source.uName,
                                                                  eventName: _eventName, 
                                                                  requestId: id, requestor: this.casa.uName, transaction: _data.transaction } };

      this.incompleteRequests[id] = new PeerCasaRequestor(id, (_err, _res) => {
         console.log(this.uName + ': Unable to send SetProperty request to source ' + _source.uName + ' at peer casa ');
      }, this.socket);

      this.incompleteRequests[id].sendRequest(message, (_requestId) => {
         console.log(this.uName + ': Timeout occurred sending a changeProperty request for source ' + _source.uName);
         delete this.incompleteRequests[_requestId];
      });

      return true;
   }
   else {
      return false;
   }
};

PeerCasa.prototype.addSource = function(_source) {
   // Peer source being added to peer casa
   console.log(this.uName + ': Source '  + _source.uName + ' added to peercasa ');
   this.sources[_source.uName] = _source;
   console.log(this.uName + ': ' + _source.uName + ' associated!');

  var added = false;

   for (var source in this.topSources) {

      if (this.topSources.hasOwnProperty(source)) {

         if (_source.uName.startsWith(source)) {
            added = true;
            break;
         }
         else if (source.startsWith(_source.uName)) {
            delete this.topSources[source];
            this.topSources[_source.uName] = _source;
            added = true;
            break;
         }
      }
   }

   if (!added) {
      this.topSources[_source.uName] = _source;
   }

   this.gang.casa.scheduleRefreshSourceListeners();
}

PeerCasa.prototype.findNewMainSource = function(_oldPeerSourceName) {
   console.log(this.uName + ": Finding new main source as current main source has gone invalid");
   var currentPriority = 0;
   var topPriority = 0;

   // Check to see if source exists before looking for peers
   var source = this.gang.casa.getSource(_oldPeerSourceName);

   if (source) {
      currentPriority = source.priority;
      topPriority = currentPriority;
   }

   var peerSource = this.gang.findNewPeerSource(_oldPeerSourceName, this);
   var newMainSource = null;

   if (peerSource && source) {

      if (peerSource.priority > source.priority) {
         newMainSource = peerSource;
      }
      else {
         newMainSource = source;
      }
   }
   else if (peerSource) {
      newMainSource = peerSource;
   }
   else if (source) {
      newMainSource = source;
   }

   if (newMainSource) {
      newMainSource.becomeMainSource();
      this.gang.casa.refreshSourceListeners();
   }
};

PeerCasa.prototype.getSource = function(_sourceFullName) {
   return this.sources[_sourceFullName];
};

PeerCasa.prototype.bowSource = function(_source, _currentlyActive) {
   console.log(this.uName + ": bowSource() Making source " + _source.uName + " passive"); 

   if (_currentlyActive) {
      _source.detach();
   }
   this.bowingSources[_source.uName] = _source;
}

PeerCasa.prototype.standUpSourceFromBow = function(_source) {
   console.log(this.uName + ": standUpSourceFromBow() Making source " + _source.uName + " active");

   if (!this.gang.addNamedObject(_source)) {
      console.error(this.uName + ": standUpSourceFromBow() Unable to find owner for source=" + _source.uName);
      return;
   }

   delete this.bowingSources[_source.uName];
};

PeerCasa.prototype.getBowingSource = function(_sourceFullName) {
   var bowingSource = null;

   for (var source in this.bowingSources) {

      if (this.bowingSources.hasOwnProperty(source) && source.startsWith(_sourceFullName)) {
         bowingSource = this.bowingSources[source].findNamedObject(_sourceFullName);

         if (bowingSource) {
            break;
         }    
      }
   }

   return bowingSource;
};

module.exports = exports = PeerCasa;

