var util = require('util');
var Source = require('./source');
var S = require('string');
var io = require('socket.io-client');
var CasaSystem = require('./casasystem');

function PeerCasa(_config) {
   this.name = _config.name;
   this.uName = (_config.hasOwnProperty('uName')) ? _config.uName : _config.code + ":" + _config.name;

   this.casaSys = CasaSystem.mainInstance();
   this.casa = this.casaSys.casa;
   this.config = _config;
   this.secureMode = this.casa.secureMode;
   this.certPath = this.casa.certPath;
   this.persistent = false;
   this.proActiveConnect = false;

   this.casaArea = null;
   this.remoteCasas = [];
   this.deathTime = 500;

   Source.call(this, _config);

   this.sources = [];
   this.workers = [];

   this.listenersSetUp = false;
   this.casaListeners = [];

   this.connected = false;
   this.valid = true;
   this.socket = null;
   this.intervalId = null;
   this.unAckedMessages = [];
   this.messageId = 0;

   this.incompleteRequests = [];
   this.reqId = 0;

   this.lastHeartbeat = Date.now() + 10000;
   this.manualDisconnect = false;

   // Callbacks for listening to main casa
   this.sourcePropertyChangedCasaHandler = PeerCasa.prototype.sourcePropertyChangedCasaCb.bind(this);
   this.sourceEventRaisedCasaHandler = PeerCasa.prototype.sourceEventRaisedCasaCb.bind(this);

   // publish source changes in this node (casa object) to remote casas
   this.casa.on('source-property-changed', this.sourcePropertyChangedCasaHandler);
   this.casa.on('source-event-raised', this.sourceEventRaisedCasaHandler);
}

util.inherits(PeerCasa, Source);

PeerCasa.prototype.coldStart = function() {
   Source.prototype.coldStart.call(this);

   for (var prop in this.sources) {

      if (this.sources.hasOwnProperty(prop)){
         console.log(this.uName + ': Cold starting peer source ' + this.sources[prop].uName);
         this.sources[prop].coldStart();
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

      if (!_data.local) {
         console.log(this.uName + ': publishing source ' + _data.sourceName + ' event-raised to peer casa');
         this.sendMessage('source-event-raised', _data);
      }
      else {
         console.log(this.uName + ': not publishing source ' + _data.sourceName + ' event-raised to peer casa - Not Global');
      }
   }
};

PeerCasa.prototype.removeCasaListeners = function() {
   console.log(this.uName + ': removing casa listeners');

   if (!this.persistent) {
      this.casa.removeListener('source-property-changed', this.sourcePropertyChangedCasaHandler);
      this.casa.removeListener('source-event-raised', this.sourceEventRaisedCasaHandler);
   }
}

PeerCasa.prototype.invalidateSources = function() {

   for(var prop in this.sources) {

      if(this.sources.hasOwnProperty(prop)){
         console.log(this.uName + ': Invaliding source ' + this.sources[prop].uName);
         this.sources[prop].invalidateSource();
         delete this.sources[prop];
      }
   }

   delete this.sources;
   this.sources = [];

   for (var prop in this.remoteCasas) {

      if (this.remoteCasas.hasOwnProperty(prop)){
         console.log(this.uName + ': Invaliding remote casa ' + this.remoteCasas[prop].uName);
         var remoteCasa = this.remoteCasas[prop];
         this.remoteCasas[prop].invalidateSources();
         this.casaSys.removeRemoteCasa(this.remoteCasas[prop]);
         delete this.remoteCasas[prop];
         delete remoteCasa;
      }
   }

   delete this.remoteCasas;
   this.remoteCasas = [];
   this.goInvalid('ACTIVE', { sourceName: this.uName });
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
   }, 10000);

   console.log(this.uName + ': Connected to my peer. Waiting for login.');
};

PeerCasa.prototype.socketLoginCb = function(_config) {
   console.log(this.uName + ': login: ' + _config.casaName);

   if (!_config.messageId) {
      this.socket.disconnect();
      this.manualDisconnect = true;
      this.deleteMeIfNeeded();
      return;
   }

   if (_config.casaVersion && _config.casaVersion < parseFloat(this.casaSys.version)) {
      console.info(this.uName + ': rejecting login from casa' + _config.casaName + '. Version mismatch!');
      this.socket.emit('loginRREEJJ', { messageId: _config.messageId, casaName: this.casa.uName, reason: "version-mismatch" });
      this.socket.disconnect();
      this.manualDisconnect = true;
      this.deleteMeIfNeeded();
      return;
   }

   this.config = deepCopyData(_config);
   this.changeName(this.config.casaName);
   this.name = this.config.casaName;
   this.createSources(this.config, this);

   if (!this.casaSys.addRemoteCasa(this)) {
      console.info(this.uName + ': rejecting login from casa' + _config.casaName + '. PeerCasa already running!');
      this.manualDisconnect = true;
      this.socket.disconnect();
      this.deleteMeIfNeeded();
      return;
   }

   clearTimeout(this.loginTimer);
   this.loginTimer = null;

   this.casa.refreshConfigWithSourcesStatus();

   // Cold start Peer Casa and all the peers sources now that everything has been created
   this.coldStart();

   this.ackMessage('login', { messageId: _config.messageId, casaName: this.casa.uName, casaConfig: this.casa.config });
   this.establishHeartbeat();

   var casaList = this.casaArea.buildCasaForwardingList();
   var casaListLen = casaList.length;

   // Send info regarding all relevant casas
   for (var i = 0; i < casaListLen; ++i) {
      casaList[i].refreshConfigWithSourcesStatus();
      this.sendMessage('casa-active', { sourceName: casaList[i].uName, casaConfig: casaList[i].config });
   }

   this.resendUnAckedMessages();
   this.alignPropertyValue('ACTIVE', true, { sourceName: this.uName });
};

PeerCasa.prototype.connectToPeerCasa = function(_config) {
   this.proActiveConnect = true;

   if (_config) {
      this.loginAs = _config.hasOwnProperty('loginAs') ? _config.loginAs : 'peer';
      this.persistent = (_config.hasOwnProperty('persistent')) ? _config.persistent : false;
      this.address = _config.address;

      if (this.secureMode) {
         var fs = require('fs');
         this.http = "https";
         this.socketOptions = {
            secure: true,
            rejectUnauthorized: false,
            key: fs.readFileSync(this.certPath+'/client.key'),
            cert: fs.readFileSync(this.certPath+'/client.crt'),
            ca: fs.readFileSync(this.certPath+'/ca.crt')
         };
      }
      else {
         this.http = "http";
         this.socketOptions = { transports: ['websocket'] };
      }

      if (this.persistent && this.proActiveConnect) {
         //this.socketOptions.reconnection = true;
         //this.socketOptions.reconnectionDelay = 1000;
         //this.socketOptions.reconnectionDelayMax = 5000;
         //this.socketOptions.reconnectionAttempts = 99999;
         this.socketOptions.forceNew = true;
         this.socketOptions.reconnection = false;
      }
      else {
         this.socketOptions.forceNew = true;
         this.socketOptions.reconnection = false;
      }
   }

   console.log(this.uName + ': Attempting to connect to peer casa ' + this.address.hostname + ':' + this.address.port);
   this.socket = io(this.http + '://' + this.address.hostname + ':' + this.address.port + '/', this.socketOptions);
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
      this.socket.removeListener('casa-activeAACCKK', this.socketCasaActiveAckHandler);
      this.socket.removeListener('source-property-changed', this.socketSourcePropertyChangedHandler);
      this.socket.removeListener('source-property-changedAACCKK', this.socketSourcePropertyChangedAckHandler);
      this.socket.removeListener('source-event-raised', this.socketSourceEventRaisedHandler);
      this.socket.removeListener('source-event-raisedAACCKK', this.socketSourceEventRaisedAckHandler);
      this.socket.removeListener('set-source-property-req', this.socketSetSourcePropertyReqHandler);
      this.socket.removeListener('set-source-property-reqAACCKK', this.socketSetSourcePropertyReqAckHandler);
      this.socket.removeListener('set-source-property-resp', this.socketSetSourcePropertyRespHandler);
      this.socket.removeListener('set-source-property-respAACCKK', this.socketSetSourcePropertyRespAckHandler);
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

   this.casa.refreshConfigWithSourcesStatus();

   var messageData = {
      casaName: this.casa.uName,
      casaType: this.loginAs,
      casaConfig: this.casa.config,
      casaVersion: this.casaSys.version
   };

   if (this.loginAs == 'child') {
      var peers = [];

      for (var prop in this.casaSys.remoteCasas) {

         if (this.casaSys.remoteCasas.hasOwnProperty(prop) && this.casaSys.remoteCasas[prop] && (this.casaSys.remoteCasas[prop].loginAs == 'peer')){
            peers.push(this.casaSys.remoteCasas[prop].uName);
         }
      }

      if (peers.length > 0) {
         messageData.peers = peers;
      }
   }

   this.sendMessage('login', messageData);

   this.loginTimer = setTimeout( () => {
      console.info(this.uName + ': giving up on login with casa' + this.uName + '. Timed out!');
      this.manualDisconnect = true;
      this.socket.disconnect();
      this.deleteMeIfNeeded();
   }, 10000);

};

PeerCasa.prototype.socketLoginSuccessCb = function(_data) {
   console.log(this.uName + ': Login Event ACKed by my peer. Going active.');

   clearTimeout(this.loginTimer);
   this.loginTimer = null;

   if (this.uName != _data.casaName) {
      console.log(this.uName + ': Casa name mismatch! Aligning client peer casa name to server name ('+_data.casaName+')');
      this.casaSys.removeRemoteCasa(this);
      this.changeName(_data.casaName);
      this.name = _data.casaName;
      this.casaSys.addRemoteCasa(this);
   }

   this.messageHasBeenAcked(_data);
   this.resendUnAckedMessages();
   this.createSources(_data, this);
   this.connected = true;

   // Cold start Peer Casa and all the peers sources now that everything has been created
   this.coldStart();

   this.establishHeartbeat();

   var casaList = this.casaArea.buildCasaForwardingList();
   var casaListLen = casaList.length;

   // Send info regarding all relevant casas
   for (var i = 0; i < casaListLen; ++i) {
      this.sendMessage('casa-active', { sourceName: casaList[i].uName, casaConfig: casaList[i].config });
   }  

   this.alignPropertyValue('ACTIVE', true, { sourceName: this.uName });
};

PeerCasa.prototype.socketLoginFailureCb = function(_data) {
   console.info(this.uName + ': Login Event REJed by my peer. Exiting.');
   process.exit(2);
};

PeerCasa.prototype.socketCasaActiveAckCb = function(_data) {
   console.log(this.uName + ': casa-active Event ACKed by my peer.');
   this.messageHasBeenAcked(_data);
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
      this.emit('broadcast-message', { message: 'casa-inactive', data: { sourceName: this.uName }, sourceCasa: this.uName });
      this.removeCasaListeners();
      this.invalidateSources();
   }

   this.manualDisconnect = true; // *** TBD ADDED temporarily for testing
   this.socket.disconnect();
   this.deleteMeIfNeeded();
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
      this.emit('broadcast-message', { message: 'casa-inactive', data: { sourceName: this.uName }, sourceCasa: this.uName });
      this.removeCasaListeners();
      this.invalidateSources();
   }

   this.manualDisconnect = true; // *** TBD ADDED temporarily for testing

   if (this.socket) {
      this.socket.disconnect();
   }
   this.deleteMeIfNeeded();
};

PeerCasa.prototype.socketCasaActiveCb = function(_data) {
   console.log('casa area ' + this.casaArea.uName);
   console.log(this.uName + ': Event received from my peer. Event name: casa-active, casa: ' + _data.sourceName);
   this.emit('broadcast-message', { message: 'casa-active', data:_data, sourceCasa: this.uName });

   if (!this.casaSys.remoteCasas[_data.sourceName] && _data.sourceName != this.casa.uName && _data.sourceName != this.uName) {
      // Create a remote casa to represent the newly available casa
      RemoteCasa = require('./remotecasa');
      var remoteCasa = new RemoteCasa(_data.casaConfig, this);
      this.remoteCasas[remoteCasa.uName] = remoteCasa;
      this.casaSys.remoteCasas[remoteCasa.uName] = remoteCasa;
      this.casaSys.allObjects[remoteCasa.uName] = remoteCasa;
      this.createSources(_data, remoteCasa);
   }
   this.emit('casa-active', _data);
   this.ackMessage('casa-active', _data);
};

PeerCasa.prototype.socketCasaInactiveCb = function(_data) {
   console.log(this.uName + ': Event received from my peer. Event name: casa-inactive, casa: ' + _data.sourceName);
   this.emit('broadcast-message', { message: 'casa-inactive', data:_data, sourceCasa: this.uName });
   this.emit('casa-inactive', _data);

   var remoteCasa = this.casaSys.remoteCasas[_data.sourceName];

   if (remoteCasa && remoteCasa.loginAs == 'remote') {
      remoteCasa.invalidateSources();
      delete this.remoteCasas[remoteCasa.uName];
      delete this.casaSys.remoteCasas[remoteCasa.uName];
      delete this.casaSys.allObjects[remoteCasa.uName];
      delete remoteCasa;
   }
   this.ackMessage('casa-inactive', _data);
};

PeerCasa.prototype.socketSourcePropertyChangedCb = function(_data) {
   console.log(this.uName + ': Event received from my peer. Event name: property-changed, source: ' + _data.sourceName);
   this.emit('source-property-changed', _data);
   this.emit('broadcast-message', { message: 'source-property-changed', data:_data, sourceCasa: this.uName });

   if (this.sources[_data.sourceName]) {
      _data.sourcePeerCasa = this.uName;
      this.sources[_data.sourceName].sourceHasChangedProperty(_data);
   }
   this.ackMessage('source-property-changed', _data);
};

PeerCasa.prototype.socketSourcePropertyChangedAckCb = function(_data) {
   console.log(this.uName + ': Property-changed Event ACKed by my peer. Source=' + _data.sourceName);
   this.messageHasBeenAcked(_data);
};

PeerCasa.prototype.socketSourceEventRaisedCb = function(_data) {
   console.log(this.uName + ': Event received from my peer. Event name: event-raised, source: ' + _data.sourceName);
   this.emit('source-event-raised', _data);
   this.emit('broadcast-message', { message: 'source-event-raised', data:_data, sourceCasa: this.uName });

   if (this.sources[_data.sourceName]) {
      _data.sourcePeerCasa = this.uName;
      this.sources[_data.sourceName].sourceHasRaisedEvent(_data);
   }
   this.ackMessage('source-event-raised', _data);
};

PeerCasa.prototype.socketSourceEventRaisedAckCb = function(_data) {
   console.log(this.uName + ': Event-raised Event ACKed by my peer. Source=' + _data.sourceName);
   this.messageHasBeenAcked(_data);
};

PeerCasa.prototype.socketSetSourcePropertyReqCb = function(_data) {
   console.log(this.uName + ': Event received from my peer. Event name: set-source-property-req, source: ' + _data.sourceName);
   var source = this.casaSys.findSource(_data.sourceName);

   if (source) {
      _data.acker = this.casa.uName;
      this.ackMessage('set-source-property-req', _data);

      var res;

      if (_data.hasOwnProperty('ramp')) {
         res = source.setPropertyWithRamp(_data.property, _data.ramp, _data);
      }
      else {
         res = source.setProperty(_data.property, _data.value, _data);
      }

      this.socket.emit('set-source-property-resp', { sourceName: source.uName, requestId: _data.requestId, result: res, requestor: _data.requestor });
   } 
   else {
      // TBD Find the casa that ownes the source and work out how to foward the request
      this.emit('forward-request', { message: 'set-source-property-req', data: _data, sourceCasa: this.uName });
   }
};

PeerCasa.prototype.socketSetSourcePropertyReqAckCb = function(_data) {
   console.log(this.uName + ': set source property request event ACKed by my peer. *Not confirmed*. Source=' + _data.sourceName);

   if (_data.requestor == this.casa.uName) {
      // We made the request
      this.messageHasBeenAcked(_data);

      if (this.incompleteRequests[_data.requestId]) {
         this.incompleteRequests[_data.requestId].ackRequest();
      }
   }
   else {
      // we didn't make the request, so forward the ACK
      this.emit('forward-request', { message: 'set-source-property-reqAACCKK', data: _data});
   }
};

PeerCasa.prototype.socketSetSourcePropertyRespCb = function(_data) {
   console.log(this.uName + ': Event received from my peer. Event name: set-source-property-resp, source: ' + _data.sourceName);

   if (_data.requestor == this.casa.uName) {
      // Request origniated from here
      _data.acker = this.casa.uName;
      this.ackMessage('set-source-property-resp', _data);

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

PeerCasa.prototype.socketSetSourcePropertyRespAckCb = function(_data) {
   console.log(this.uName + ': set source property response event ACKed by my peer. Source=' + _data.sourceName);

   if (_data.requestor == this.casa.uName) {
      // We made the request
      this.messageHasBeenAcked(_data);
   }
   else {
      // we didn't make the request, so forward the ACK
      this.emit('forward-response', { message: 'set-source-property-respAACCKK', data: _data});
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
      this.alignPropertyValue('ACTIVE', false, { sourceName: this.uName });

      if (this.manualDisconnect) {
         // Recreate socket to attempt reconnection
         this.manualDisconnect = false;
      }

      console.log(this.uName + ': Attempting to re-establish connection after manual disconnection');
      this.deleteSocket();

      setTimeout( () => {
         this.connectToPeerCasa();
      }, 10000);
   }
   else {

      if (this.socket) {

         if (!this.manualDisconnect) {
            this.socket.disconnect();
         }

         this.deleteSocket();
      }

      if (this.proActiveConnect) {
         this.setCasaArea(null);	// ** TBD Does this only apply for proActiveConnect?
      }

      console.log(this.uName + ': Deleting non-persistent Peercasa object - using death timer');
      this.casaSys.removeRemoteCasa(this);

      setTimeout( () => {

         if (!this.connected) {
            console.log(this.uName + ': Peercasa object has been deleted - cleanup complete');
            delete this;
         }
      }, this.deathTime);
   }
}

PeerCasa.prototype.refreshConfigWithSourcesStatus = function() {
   delete this.config.sourcesStatus;
   this.config.sourcesStatus = [];
   var len = this.config.sources.length;

   for (var i = 0; i < len; ++i) {
      var allProps = {};
      var props = this.sources[this.config.sources[i]].props

      for (var name in props) {

         if (props.hasOwnProperty(name)) {
            allProps[name] = props[name].value;
         }
      }

      this.config.sourcesStatus.push({ properties: copyData(allProps), status: this.sources[this.config.sources[i]].isActive() });
   }
}

function deepCopyData(_sourceData) {
   return JSON.parse(JSON.stringify(_sourceData));
}

function copyData(_sourceData) {
   var newData = {};

   for (var prop in _sourceData) {

      if (_sourceData.hasOwnProperty(prop)){
         newData[prop] = _sourceData[prop];
      }
   }

   return newData;
}

PeerCasa.prototype.createSources = function(_data, _peerCasa) {

   if (_data.casaConfig &&  _data.casaConfig.sources && _data.casaConfig.sourcesStatus) {
      var len = _data.casaConfig.sources.length;
      console.log(_peerCasa.uName + ': New sources found = ' + len);
      console.log(_peerCasa.uName + ': New sources status found = ' + _data.casaConfig.sourcesStatus.length);

      var PeerSource = require('./peersource');
      for (var i = 0; i < len; ++i) {
         console.log(_peerCasa.uName + ': Creating peer source named ' + _data.casaConfig.sources[i]);
         var source = new PeerSource(_data.casaConfig.sources[i], _data.casaConfig.sourcesStatus[i].properties, _peerCasa);
      }
   }

   // Refresh all inactive sources and workers
   this.casaSys.casa.refreshSourceListeners();
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
      this.socketCasaActiveAckHandler = PeerCasa.prototype.socketCasaActiveAckCb.bind(this);
      this.socketSourcePropertyChangedHandler = PeerCasa.prototype.socketSourcePropertyChangedCb.bind(this);
      this.socketSourcePropertyChangedAckHandler = PeerCasa.prototype.socketSourcePropertyChangedAckCb.bind(this);
      this.socketSourceEventRaisedHandler = PeerCasa.prototype.socketSourceEventRaisedCb.bind(this);
      this.socketSourceEventRaisedAckHandler = PeerCasa.prototype.socketSourceEventRaisedAckCb.bind(this);
      this.socketSetSourcePropertyReqHandler = PeerCasa.prototype.socketSetSourcePropertyReqCb.bind(this);
      this.socketSetSourcePropertyReqAckHandler = PeerCasa.prototype.socketSetSourcePropertyReqAckCb.bind(this);
      this.socketSetSourcePropertyRespHandler = PeerCasa.prototype.socketSetSourcePropertyRespCb.bind(this);
      this.socketSetSourcePropertyRespAckHandler = PeerCasa.prototype.socketSetSourcePropertyRespAckCb.bind(this);
      this.socketHeartbeatHandler = PeerCasa.prototype.socketHeartbeatCb.bind(this);

      this.socket.on('error', this.socketErrorHandler);
      this.socket.on('connect_error', this.socketErrorHandler);
      this.socket.on('connect_timeout', this.socketErrorHandler);
      this.socket.on('disconnect', this.socketDisconnectHandler);
      this.socket.on('casa-active', this.socketCasaActiveHandler);
      this.socket.on('casa-inactive', this.socketCasaInactiveHandler);
      this.socket.on('casa-activeAACCKK', this.socketCasaActiveAckHandler);
      this.socket.on('source-property-changed', this.socketSourcePropertyChangedHandler);
      this.socket.on('source-property-changedAACCKK', this.socketSourcePropertyChangedAckHandler);
      this.socket.on('source-event-raised', this.socketSourceEventRaisedHandler);
      this.socket.on('source-event-raisedAACCKK', this.socketSourceEventRaisedAckHandler);
      this.socket.on('set-source-property-req', this.socketSetSourcePropertyReqHandler);
      this.socket.on('set-source-property-reqAACCKK', this.socketSetSourcePropertyReqAckHandler);
      this.socket.on('set-source-property-resp', this.socketSetSourcePropertyRespHandler);
      this.socket.on('set-source-property-respAACCKK', this.socketSetSourcePropertyRespAckHandler);
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
   var id = this.uName + ':active:' + this.reqId;
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

   for(var prop in this.unAckedMessages) {

      if(this.unAckedMessages.hasOwnProperty(prop) && this.unAckedMessages[prop]) {
         this.socket.emit(this.unAckedMessages[prop].message, this.unAckedMessages[prop].data);
      }
   }

   var toDelete = [];
   for(var prop2 in this.incompleteRequests) {

      if(this.incompleteRequests.hasOwnProperty(prop2)){
         this.incompleteRequests[prop2].resendRequest( (_requestId) => {
            toDelete.push(requestId);
         });
      }
   }

   // Clean up any already acked messages
   toDelete.forEach( (_requestId) => {
      delete this.incompleteRequests[_requestId];
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
   this.message = _message;
   this.socket.emit(this.message.message, this.message.data);

   this.timeout = setTimeout( () => {
      this.callback(false);
      _deleteMe(this.requestId);
   }, 30000);
}

RemoteCasaRequestor.prototype.resendRequest = function(_deleteMe) {

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

      this.timeout = setTimeout( () => {
         this.callback(false);
         _deleteMe(this.requestId);
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

PeerCasa.prototype.setSourceProperty = function(_source, _propName, _propValue, _data) {

   if (this.connected) {
      console.log(this.uName + ': requesting source change property ' + _propName + ' to ' + _propValue + ' from peer casa. Source ' + _source.uName);
      var id = this.uName + ':changeprop:' + this.reqId;
      this.reqId = (this.reqId +  1) % 10000;
      var message = { message: 'set-source-property-req', data: { casaName: this.uName, sourceName: _source.uName,
                                                                  property: _propName, value: _propValue,
                                                                  requestId: id, requestor: this.casa.uName } };

      this.incompleteRequests[id] = new RemoteCasaRequestor(id, (_err, _res) => {
         console.log(this.uName + ': Unable to send SetProperty request to source ' + _source.uName + ' at remote casa ');
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
                                                                  requestId: id, requestor: this.casa.uName } };

      this.incompleteRequests[id] = new RemoteCasaRequestor(id, (_err, _res) => {
         console.log(this.uName + ': Unable to send SetProperty request to source ' + _source.uName + ' at remote casa ');
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

PeerCasa.prototype.addSource = function(_source) {
   // Peer source being added to peer casa
   console.log(this.uName + ': Source '  +_source.uName + ' added to peercasa ');
   this.sources[_source.uName] = _source;
   console.log(this.uName + ': ' + _source.uName + ' associated!');
}

PeerCasa.prototype.addWorker = function(_worker) {
   console.log(this.uName + ': Worker '  + _worker.uName + ' added to peercasa ');
   this.workers[_worker.uName] = _worker;
}

PeerCasa.prototype.setCasaArea = function(_casaArea) {

   if (this.casaArea != _casaArea) {

      if (this.casaArea) {
         this.casaArea.removeCasa(this);
         this.casaArea.removeListener('broadcast-message', this.broadcastHandler);
      }

      this.casaArea = _casaArea;
      this.broadcastHandler = PeerCasa.prototype.broadcastCb.bind(this);

      if (this.casaArea) {
         this.casaArea.addCasa(this);
         // listen for broadcast messages from other nodes to remote casas
         this.casaArea.on('broadcast-message', this.broadcastHandler);
      }
   }
}

PeerCasa.prototype.broadcastCb = function(_message) {
   console.log(this.uName + ': received message ' + _message.message + ' originally from ' + _message.data.sourceName + ' passed on from casa ' + _message.sourceCasa);
   console.log(this.connected.toString() + ' ' + _message.sourceCasa + ' ' + this.uName);

   if (this.connected && _message.sourceCasa != this.uName) {
      console.log(this.uName + ': publishing message ' + _message.message + ' orginally from ' + _message.data.sourceName + ' passed on from casa ' + _message.sourceCasa);
      this.sendMessage(_message.message, _message.data);
   }
};

module.exports = exports = PeerCasa;

