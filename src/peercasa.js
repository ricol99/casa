var util = require('./util');
var SourceBase = require('./sourcebase');
var S = require('string');
var io = require('socket.io-client');
var Gang = require('./gang');
var NamedObject = require('./namedobject');

function PeerCasa(_config, _owner) {
   this.name = _config.uName;

   this.gang = Gang.mainInstance();
   this.casa = this.gang.casa;
   this.consoleApiService =  this.gang.casa.findService("consoleapiservice");

   this.config = _config;
   this.secureMode = this.casa.secureMode;
   this.certPath = this.casa.certPath;
   this.persistent = false;
   this.proActiveConnect = false;

   this.casaArea = null;
   this.remoteCasas = [];
   this.deathTime = 500;

   SourceBase.call(this, (_config.hasOwnProperty('uName')) ? _config.uName : _config.code + ":" + _config.name, _owner);

   this.sources = [];
   this.workers = [];

   this.listenersSetUp = false;
   this.casaListeners = [];

   this.connected = false;
   this.socket = null;
   this.intervalId = null;
   this.unAckedMessages = [];
   this.messageId = 0;

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

   // publish source changes in this node (casa object) to remote casas
   this.casa.on('source-property-changed', this.sourcePropertyChangedCasaHandler);
   this.casa.on('source-event-raised', this.sourceEventRaisedCasaHandler);
   this.casa.on('source-added', this.sourceAddedCasaHandler);
   this.casa.on('source-removed', this.sourceRemovedCasaHandler);

   this.ensurePropertyExists('ACTIVE', 'property', { initialValue: false }, _config);

   this.gang.addPeerCasa(this);
}

util.inherits(PeerCasa, SourceBase);

PeerCasa.prototype.coldStart = function() {
   SourceBase.prototype.coldStart.call(this);

   for (var source in this.sources) {

      if (this.sources.hasOwnProperty(source)){
         console.log(this.fullName + ': Cold starting peer source ' + this.sources[source].fullName);
         this.sources[source].coldStart();
      }
   }
};

PeerCasa.prototype.sourcePropertyChangedCasaCb = function(_data) {

   if (this.connected && (_data.sourcePeerCasa != this.fullName)) {

      if (!(_data.hasOwnProperty("local") && _data.local)) {
         console.log(this.fullName + ': publishing source ' + _data.sourceName + ' property-changed to peer casa');
         this.sendMessage('source-property-changed', _data);
      }
   }
};

PeerCasa.prototype.sourceEventRaisedCasaCb = function(_data) {

   if (this.connected && (_data.sourcePeerCasa != this.fullName)) {

      if (!_data.local) {
         console.log(this.fullName + ': publishing source ' + _data.sourceName + ' event-raised to peer casa');
         this.sendMessage('source-event-raised', _data);
      }
      else {
         console.log(this.fullName + ': not publishing source ' + _data.sourceName + ' event-raised to peer casa - Not Global');
      }
   }
};

PeerCasa.prototype.sourceAddedCasaCb = function(_data) {

   if (this.connected && (_data.sourcePeerCasa != this.fullName)) {

      if (!_data.local) {
         console.log(this.fullName + ': publishing source ' + _data.sourceName + ' added to peer casa');
         var source = this.casa.getSource(_data.sourceName);
         var allProps = {};
         source.getAllProperties(allProps);
         _data.sourceUName = source.uName;
         _data.sourcePriority = (source.hasOwnProperty('priority')) ? source.priority : 0;
         _data.sourceProperties = util.copy(allProps);
         this.sendMessage('source-added', _data);
      }
      else {
         console.log(this.fullName + ': not publishing source ' + _data.sourceName + ' added to peer casa - Not Global');
      }
   }
};

PeerCasa.prototype.sourceRemovedCasaCb = function(_data) {

   if (this.connected && (_data.sourcePeerCasa != this.fullName)) {

      if (!_data.local) {
         console.log(this.fullName + ': publishing source ' + _data.sourceName + ' removed from peer casa');
         this.sendMessage('source-removed', _data);
      }
      else {
         console.log(this.fullName + ': not publishing source ' + _data.sourceName + ' removed from peer casa - Not Global');
      }
   }
};

PeerCasa.prototype.removeCasaListeners = function() {
   console.log(this.fullName + ': removing casa listeners');

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

   for (var source in this.remoteCasas) {

      if (this.remoteCasas.hasOwnProperty(source)){
         console.log(this.fullName + ': Invaliding remote casa ' + this.remoteCasas[source].fullName);
         var remoteCasa = this.remoteCasas[source];
         this.remoteCasas[source].invalidate();
         this.gang.removeRemoteCasa(this.remoteCasas[source]);
         delete this.remoteCasas[source];
         delete remoteCasa;
      }
   }

   delete this.remoteCasas;
   this.remoteCasas = [];
   this.props['ACTIVE'].invalidate(false);
   this.gang.casa.refreshSourceListeners();
}

PeerCasa.prototype.getHostname = function() {
   return this.address.hostname;
};

PeerCasa.prototype.getPort = function() {
   return this.address.port;
};

PeerCasa.prototype.serveClient = function(_socket) {
   console.log(this.fullName + ': I am connected to my peer. Socket: ' + _socket);

   this.connected = true;
   this.socket = _socket;
   this.establishListeners();

   this.loginTimer = setTimeout( () => {
      console.info(this.fullName + ': rejecting login from anonymous casa. Timed out!');
      this.socket.disconnect();
      this.manualDisconnect = true;
      this.deleteMeIfNeeded();
   }, 10000);

   console.log(this.fullName + ': Connected to my peer. Waiting for login.');
};

PeerCasa.prototype.disconnectFromClient = function() {

   if (this.connected) {
      this.socket.disconnect();
      this.manualDisconnect = true;
      this.deleteMeIfNeeded();
   }
};

PeerCasa.prototype.socketLoginCb = function(_config) {
   console.log(this.fullName + ': login: ' + _config.casaName);

   if (!_config.messageId) {
      this.socket.disconnect();
      this.manualDisconnect = true;
      this.deleteMeIfNeeded();
      return;
   }

   if (_config.casaVersion && _config.casaVersion < parseFloat(this.gang.version)) {
      console.info(this.fullName + ': rejecting login from casa' + _config.casaName + '. Version mismatch!');
      this.socket.emit('loginRREEJJ', { messageId: _config.messageId, casaName: this.casa.fullName, reason: "version-mismatch" });
      this.disconnectFromClient();
      return;
   }

   this.config = util.copy(_config, true);
   this.gang.changePeerCasaName(this, this.config.casaName);
   this.changeName(this.config.casaName.substr(2));	// XXX HACK
   this.createSources(this.config, this);

   if (!this.gang.addRemoteCasa(this)) {
      console.info(this.fullName + ': closing down existing peercasa session from casa' + _config.casaName);
      this.gang.remoteCasas[this.fullName].disconnectFromClient();
      this.gang.addRemoteCasa(this, true);
      return;
   }

   clearTimeout(this.loginTimer);
   this.loginTimer = null;

   var simpleConfig = this.casa.refreshSimpleConfig();

   // Cold start Peer Casa and all the peers sources now that everything has been created
   this.coldStart();

   this.ackMessage('login', { messageId: _config.messageId, gangHash: this.gang.gangDb.getHash(), casaName: this.casa.fullName, casaConfig: simpleConfig });
   this.establishHeartbeat();

   var casaList = this.casaArea.buildCasaForwardingList();
   var casaListLen = casaList.length;

   // Send info regarding all relevant casas
   for (var i = 0; i < casaListLen; ++i) {
      var simpleConfig2 = casaList[i].refreshSimpleConfig();
      this.sendMessage('casa-active', { sourceName: casaList[i].fullName, casaConfig: simpleConfig2 });
   }

   this.resendUnAckedMessages();
   this.alignPropertyValue('ACTIVE', true, { sourceName: this.fullName });
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

   console.log(this.fullName + ': Attempting to connect to peer casa ' + this.address.hostname + ':' + this.address.port);
   this.socket = io(this.http + '://' + this.address.hostname + ':' + this.address.port + '/peercasa', this.socketOptions);
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
      this.socket.removeListener('source-added', this.socketSourceAddedHandler);
      this.socket.removeListener('source-addedAACCKK', this.socketSourceAddedAckHandler);
      this.socket.removeListener('source-removed', this.socketSourceRemovedHandler);
      this.socket.removeListener('source-removedAACCKK', this.socketSourceRemovedAckHandler);
      this.socket.removeListener('console-command', this.socketConsoleCommandHandler);
      this.socket.removeListener('console-commandAACCKK', this.socketConsoleCommandAckHandler);
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
   console.log(this.fullName + ': Connected to my peer. Logging in...');

   var simpleConfig = this.casa.refreshSimpleConfig();

   var messageData = {
      casaName: this.casa.fullName,
      casaType: this.loginAs,
      casaConfig: simpleConfig,
      casaVersion: this.gang.version
   };

   if (this.loginAs == 'child') {
      var peers = [];

      for (var prop in this.gang.remoteCasas) {

         if (this.gang.remoteCasas.hasOwnProperty(prop) && this.gang.remoteCasas[prop] && (this.gang.remoteCasas[prop].loginAs == 'peer')){
            peers.push(this.gang.remoteCasas[prop].fullName);
         }
      }

      if (peers.length > 0) {
         messageData.peers = peers;
      }
   }

   this.sendMessage('login', messageData);

   this.loginTimer = setTimeout( () => {
      console.info(this.fullName + ': giving up on login with casa' + this.fullName + '. Timed out!');
      this.manualDisconnect = true;
      this.socket.disconnect();
      this.deleteMeIfNeeded();
   }, 10000);

};

PeerCasa.prototype.socketLoginSuccessCb = function(_data) {
   console.log(this.fullName + ': Login Event ACKed by my peer. Going active.');

   clearTimeout(this.loginTimer);
   this.loginTimer = null;

   if (this.fullName != _data.casaName) {
      console.log(this.fullName + ': Casa name mismatch! Aligning client peer casa name to server name ('+_data.casaName+')');
      this.gang.removeRemoteCasa(this);
      this.gang.changePeerCasaName(this, _data.casaName);
      this.changeName(_data.casaName.substr(2));	// XXX HACK
      this.gang.addRemoteCasa(this);
   }

   if ((this.loginAs === 'child') && _data.hasOwnProperty("gangHash") && _data.gangHash.hasOwnProperty("hash")) {

      if (this.gang.gangDb.getHash().hash !== _data.gangHash.hash) {
         this.gang.updateGangDbFromParent(this);
      }
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
      this.sendMessage('casa-active', { sourceName: casaList[i].fullName, casaConfig: casaList[i].config });
   }  

   this.alignPropertyValue('ACTIVE', true, { sourceName: this.fullName });
};

PeerCasa.prototype.socketLoginFailureCb = function(_data) {
   console.info(this.fullName + ': Login Event REJed by my peer. Exiting.');
   process.exit(2);
};

PeerCasa.prototype.socketCasaActiveAckCb = function(_data) {
   console.log(this.fullName + ': casa-active Event ACKed by my peer.');
   this.messageHasBeenAcked(_data);
};

PeerCasa.prototype.socketErrorCb = function(_error) {
   console.log(this.fullName + ': Error received: ' + _error);

   if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
   }

   if (this.connected) {
      console.log(this.fullName + ': Lost connection to my peer. Going inactive.');
      this.connected = false;
      this.emit('broadcast-message', { message: 'casa-inactive', data: { sourceName: this.fullName }, sourceCasa: this.fullName });
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
   console.log(this.fullName + ': Error disconnect');

   if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
   }

   if (this.connected) {
      console.log(this.fullName + ': Lost connection to my peer. Going inactive.');
      this.connected = false;
      this.emit('broadcast-message', { message: 'casa-inactive', data: { sourceName: this.fullName }, sourceCasa: this.fullName });
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
   console.log('casa area ' + this.casaArea.fullName);
   console.log(this.fullName + ': Event received from my peer. Event name: casa-active, casa: ' + _data.sourceName);
   this.emit('broadcast-message', { message: 'casa-active', data:_data, sourceCasa: this.fullName });

   if (!this.gang.remoteCasas[_data.sourceName] && _data.sourceName != this.casa.fullName && _data.sourceName != this.fullName) {
      // Create a remote casa to represent the newly available casa
      RemoteCasa = require('./remotecasa');
      var remoteCasa = new RemoteCasa(_data.casaConfig, this);
      this.remoteCasas[remoteCasa.fullName] = remoteCasa;
      this.gang.remoteCasas[remoteCasa.fullName] = remoteCasa;
      this.createSources(_data, remoteCasa);
   }
   this.emit('casa-active', _data);
   this.ackMessage('casa-active', _data);
};

PeerCasa.prototype.socketCasaInactiveCb = function(_data) {
   console.log(this.fullName + ': Event received from my peer. Event name: casa-inactive, casa: ' + _data.sourceName);
   this.emit('broadcast-message', { message: 'casa-inactive', data:_data, sourceCasa: this.fullName });
   this.emit('casa-inactive', _data);

   var remoteCasa = this.gang.remoteCasas[_data.sourceName];

   if (remoteCasa && remoteCasa.loginAs == 'remote') {
      remoteCasa.invalidate();
      delete this.remoteCasas[remoteCasa.fullName];
      delete this.gang.remoteCasas[remoteCasa.fullName];
      delete remoteCasa;
   }
   this.ackMessage('casa-inactive', _data);
};

PeerCasa.prototype.socketSourcePropertyChangedCb = function(_data) {
   console.log(this.fullName + ': Event received from my peer. Event name: property-changed, source: ' + _data.sourceName);
   this.emit('source-property-changed', _data);
   this.emit('broadcast-message', { message: 'source-property-changed', data:_data, sourceCasa: this.fullName });

   if (this.sources[_data.sourceName]) {
      _data.sourcePeerCasa = this.fullName;
      this.sources[_data.sourceName].sourceHasChangedProperty(_data);
   }
   this.ackMessage('source-property-changed', _data);
};

PeerCasa.prototype.socketSourcePropertyChangedAckCb = function(_data) {
   console.log(this.fullName + ': Property-changed Event ACKed by my peer. Source=' + _data.sourceName);
   this.messageHasBeenAcked(_data);
};

PeerCasa.prototype.socketSourceEventRaisedCb = function(_data) {
   console.log(this.fullName + ': Event received from my peer. Event name: event-raised, source: ' + _data.sourceName);
   this.emit('source-event-raised', _data);
   this.emit('broadcast-message', { message: 'source-event-raised', data:_data, sourceCasa: this.fullName });

   if (this.sources[_data.sourceName]) {
      _data.sourcePeerCasa = this.fullName;
      this.sources[_data.sourceName].sourceHasRaisedEvent(_data);
   }
   this.ackMessage('source-event-raised', _data);
};

PeerCasa.prototype.socketSourceEventRaisedAckCb = function(_data) {
   console.log(this.fullName + ': Event-raised Event ACKed by my peer. Source=' + _data.sourceName);
   this.messageHasBeenAcked(_data);
};

PeerCasa.prototype.socketSourceAddedCb = function(_data) {
   console.log(this.fullName + ': Event received from my peer. Event name: source-added, source: ' + _data.sourceName);

   var PeerSource = require('./peersource');
   console.log(this.fullName + ': Creating peer source named ' + _data.sourceName + ' priority =' + _data.sourcePriority);
   var source = new PeerSource(_data.sourceName, _data.sourceUName, _data.sourcePriority, _data.sourceProperties, this);

   // Refresh all inactive sources and workers
   this.gang.casa.refreshSourceListeners();

   this.emit('broadcast-message', { message: 'source-added', data:_data, sourceCasa: this.fullName });
   this.ackMessage('source-added', _data);
};

PeerCasa.prototype.socketSourceAddedAckCb = function(_data) {
   console.log(this.fullName + ': Source-added Event ACKed by my peer. Source=' + _data.sourceName);
   this.messageHasBeenAcked(_data);
};

PeerCasa.prototype.socketSourceRemovedCb = function(_data) {
   console.log(this.fullName + ': Event received from my peer. Event name: source-removed, source: ' + _data.sourceName);

   if (this.sources.hasOwnProperty(_data.sourceName)) {
      this.sources[_data.sourceName].invalidate(true);
      delete this.sources[_data.sourceName];
   }

   this.emit('broadcast-message', { message: 'source-removed', data:_data, sourceCasa: this.fullName });
   this.ackMessage('source-removed', _data);
};

PeerCasa.prototype.socketSourceRemovedAckCb = function(_data) {
   console.log(this.fullName + ': Source-removed Event ACKed by my peer. Source=' + _data.sourceName);
   this.messageHasBeenAcked(_data);
};

PeerCasa.prototype.socketConsoleCommandCb = function(_data) {
   console.log(this.fullName + ': Event received from my peer. Event name: console-command, source: ' + _data.sourceName);

   if (_data.hasOwnProperty("scope") && _data.hasOwnProperty("line")) {
      this.consoleApiService.executeCommand({ scope: _data.scope, line: _data.line });
   }

   this.emit('broadcast-message', { message: 'console-command', data:_data, sourceCasa: this.fullName });
   this.ackMessage('console-command', _data);
};

PeerCasa.prototype.socketConsoleCommandAckCb = function(_data) {
   console.log(this.fullName + ': Console-command Event ACKed by my peer. Source=' + _data.sourceName);
   this.messageHasBeenAcked(_data);
};

PeerCasa.prototype.socketSetSourcePropertyReqCb = function(_data) {
   console.log(this.fullName + ': Event received from my peer. Event name: set-source-property-req, source: ' + _data.sourceName);
   var source = this.gang.findGlobalSource(_data.sourceName);

   if (source) {
      _data.acker = this.casa.fullName;
      this.ackMessage('set-source-property-req', _data);

      var res;

      if (_data.hasOwnProperty('ramp')) {
         res = source.setPropertyWithRamp(_data.property, _data.ramp, _data);
      }
      else {
         res = source.setProperty(_data.property, _data.value, _data);
      }

      this.socket.emit('set-source-property-resp', { sourceName: source.fullName, requestId: _data.requestId, result: res, requestor: _data.requestor });
   } 
   else {
      // TBD Find the casa that ownes the source and work out how to foward the request
      this.emit('forward-request', { message: 'set-source-property-req', data: _data, sourceCasa: this.fullName });
   }
};

PeerCasa.prototype.socketSetSourcePropertyReqAckCb = function(_data) {
   console.log(this.fullName + ': set source property request event ACKed by my peer. *Not confirmed*. Source=' + _data.sourceName);

   if (_data.requestor == this.casa.fullName) {
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
   console.log(this.fullName + ': Event received from my peer. Event name: set-source-property-resp, source: ' + _data.sourceName);

   if (_data.requestor == this.casa.fullName) {
      // Request origniated from here
      _data.acker = this.casa.fullName;
      this.ackMessage('set-source-property-resp', _data);

      if (this.incompleteRequests[_data.requestId]) {
         this.incompleteRequests[_data.requestId].completeRequest(_data.result);
         delete this.incompleteRequests[_data.requestId];
      }
   }
   else {
      // Find the casa that ownes the original request and work out how to foward the response
      this.emit('forward-response', { message: 'set-source-property-resp', data: _data, sourceCasa: this.fullName });
   }
};

PeerCasa.prototype.socketSetSourcePropertyRespAckCb = function(_data) {
   console.log(this.fullName + ': set source property response event ACKed by my peer. Source=' + _data.sourceName);

   if (_data.requestor == this.casa.fullName) {
      // We made the request
      this.messageHasBeenAcked(_data);
   }
   else {
      // we didn't make the request, so forward the ACK
      this.emit('forward-response', { message: 'set-source-property-respAACCKK', data: _data});
   }
};

PeerCasa.prototype.socketHeartbeatCb = function(_data) {
   console.log(this.fullName + ': Heartbeat received');

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
         this.alignPropertyValue('ACTIVE', false, { sourceName: this.fullName });

         if (this.manualDisconnect) {
            // Recreate socket to attempt reconnection
            this.manualDisconnect = false;
         }

         console.log(this.fullName + ': Attempting to re-establish connection after manual disconnection');
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

      if (this.proActiveConnect) {
         this.setCasaArea(null);	// ** TBD Does this only apply for proActiveConnect?
      }

      console.log(this.fullName + ': Deleting non-persistent Peercasa object - using death timer');
      this.gang.removeRemoteCasa(this);

      setTimeout( () => {

         if (!this.connected) {
            console.log(this.fullName + ': Peercasa object has been deleted - cleanup complete');
            delete this;
         }
      }, this.deathTime);
   }
}

PeerCasa.prototype.refreshSimpleConfig = function() {

   for (var j = 0; j < this.config.sources.length; ++j) {
      var allProps = {};
      var props = this.sources[this.config.sources[j].fullName].props;

      for (var name in props) {

         if (props.hasOwnProperty(name)) {
            allProps[name] = props[name].value;
         }
      }

      delete this.config.sources[j].properties;
      this.config.sources[j].properies = util.copy(allProps);
   }

   return this.config;
}

PeerCasa.prototype.createSources = function(_data, _peerCasa) {

   if (_data.casaConfig &&  _data.casaConfig.sources) {
      var len = _data.casaConfig.sources.length;
      console.log(_peerCasa.fullName + ': New sources found = ' + len);

      _data.casaConfig.sources.sort( (_a, _b) => {
          return _a.fullName > _b.fullName;
      });

      var PeerSource = require('./peersource');

      for (var i = 0; i < len; ++i) {
         console.log(_peerCasa.fullName + ': Creating peer source named ' + _data.casaConfig.sources[i].fullName + ' uName = ' + _data.casaConfig.sources[i].uName +
                                          ' priority =' + _data.casaConfig.sources[i].priority);
         var source = new PeerSource(_data.casaConfig.sources[i].fullName, _data.casaConfig.sources[i].uName, _data.casaConfig.sources[i].priority, _data.casaConfig.sources[i].properties, _peerCasa);
      }
   }

   // Refresh all inactive sources and workers
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
      this.socketCasaActiveAckHandler = PeerCasa.prototype.socketCasaActiveAckCb.bind(this);
      this.socketSourcePropertyChangedHandler = PeerCasa.prototype.socketSourcePropertyChangedCb.bind(this);
      this.socketSourcePropertyChangedAckHandler = PeerCasa.prototype.socketSourcePropertyChangedAckCb.bind(this);
      this.socketSourceEventRaisedHandler = PeerCasa.prototype.socketSourceEventRaisedCb.bind(this);
      this.socketSourceEventRaisedAckHandler = PeerCasa.prototype.socketSourceEventRaisedAckCb.bind(this);
      this.socketSourceAddedHandler = PeerCasa.prototype.socketSourceAddedCb.bind(this);
      this.socketSourceAddedAckHandler = PeerCasa.prototype.socketSourceAddedAckCb.bind(this);
      this.socketSourceRemovedHandler = PeerCasa.prototype.socketSourceRemovedCb.bind(this);
      this.socketSourceRemovedAckHandler = PeerCasa.prototype.socketSourceRemovedAckCb.bind(this);
      this.socketConsoleCommandHandler = PeerCasa.prototype.socketConsoleCommandCb.bind(this);
      this.socketConsoleCommandAckHandler = PeerCasa.prototype.socketConsoleCommandAckCb.bind(this);
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
      this.socket.on('source-added', this.socketSourceAddedHandler);
      this.socket.on('source-addedAACCKK', this.socketSourceAddedAckHandler);
      this.socket.on('source-removed', this.socketSourceRemovedHandler);
      this.socket.on('source-removedAACCKK', this.socketSourceRemovedAckHandler);
      this.socket.on('console-command', this.socketConsoleCommandHandler);
      this.socket.on('console-commandAACCKK', this.socketConsoleCommandAckHandler);
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
               console.log(this.fullName + ': No heartbeat received for two times the interval!. Closing socket.');
               this.manualDisconnect = true;
               this.socket.disconnect();
               this.deleteMeIfNeeded();
            }
            else {
               console.log(this.fullName + ': Last heartbeat time difference = ', Date.now() - this.lastHeartbeat);
               this.socket.emit('heartbeat', { casaName: this.casa.fullName });
            }
         }
      }, 60000);
   }
}

PeerCasa.prototype.sendMessage = function(_message, _data) {
   var id = this.fullName + ':active:' + this.reqId;
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
      console.log(this.fullName + ': requesting source change property ' + _propName + ' to ' + _propValue + ' from peer casa. Source ' + _source.fullName);
      var id = this.fullName + ':changeprop:' + this.reqId;
      this.reqId = (this.reqId +  1) % 10000;
      var message = { message: 'set-source-property-req', data: { casaName: this.fullName, sourceName: _source.fullName,
                                                                  property: _propName, value: _propValue,
                                                                  requestId: id, requestor: this.casa.fullName } };

      this.incompleteRequests[id] = new RemoteCasaRequestor(id, (_err, _res) => {
         console.log(this.fullName + ': Unable to send SetProperty request to source ' + _source.fullName + ' at remote casa ');
      }, this.socket);

      this.incompleteRequests[id].sendRequest(message, (_requestId) => {
         console.log(this.fullName + ': Timeout occurred sending a changeProperty request for source ' + _source.fullName);
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
      console.log(this.fullName + ': requesting source change property ' + _propName + ' to ' + _propValue + ' from peer casa. Source ' + _source.fullName);
      var id = this.fullName + ':changeprop:' + this.reqId;
      this.reqId = (this.reqId +  1) % 10000;
      var message = { message: 'set-source-property-req', data: { casaName: this.fullName, sourceName: _source.fullName,
                                                                  property: _propName, ramp: _ramp,
                                                                  requestId: id, requestor: this.casa.fullName } };

      this.incompleteRequests[id] = new RemoteCasaRequestor(id, (_err, _res) => {
         console.log(this.fullName + ': Unable to send SetProperty request to source ' + _source.fullName + ' at remote casa ');
      }, this.socket);

      this.incompleteRequests[id].sendRequest(message, (_requestId) => {
         console.log(this.fullName + ': Timeout occurred sending a changeProperty request for source ' + _source.fullName);
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
   console.log(this.fullName + ': Source '  + _source.fullName + ' added to peercasa ');
   this.sources[_source.fullName] = _source;
   console.log(this.fullName + ': ' + _source.fullName + ' associated!');

  var added = false;

   for (var source in this.topSources) {

      if (this.topSources.hasOwnProperty(source)) {

         if (_source.fullName.startsWith(source)) {
            console.log(this.uName+": AAAAAAA not added source "+_source.fullName);
            added = true;
            break;
         }
         else if (source.startsWith(_source.fullName)) {
            console.log(this.uName+": AAAAAAA added source "+_source.fullName);
            console.log(this.uName+": AAAAAAA removed source "+source);
            delete this.topSources[source];
            this.topSources[_source.fullName] = _source;
            added = true;
            break;
         }
      }
   }

   if (!added) {
      console.log(this.uName+": AAAAAAA added source "+_source.fullName);
      this.topSources[_source.fullName] = _source;
   }
}

PeerCasa.prototype.addWorker = function(_worker) {
   console.log(this.fullName + ': Worker '  + _worker.fullName + ' added to peercasa ');
   this.workers[_worker.fullName] = _worker;
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
   console.log(this.fullName + ': received message ' + _message.message + ' originally from ' + _message.data.sourceName + ' passed on from casa ' + _message.sourceCasa);
   console.log(this.connected.toString() + ' ' + _message.sourceCasa + ' ' + this.fullName);

   if (this.connected && _message.sourceCasa != this.fullName) {
      console.log(this.fullName + ': publishing message ' + _message.message + ' orginally from ' + _message.data.sourceName + ' passed on from casa ' + _message.sourceCasa);
      this.sendMessage(_message.message, _message.data);
   }
};

PeerCasa.prototype.findNewMainSource = function(_oldPeerSource) {
   console.log(this.fullName + ": Finding new main source as current main source has gone invalid");
   var currentPriority = 0;
   var topPriority = 0;

   // Check to see if source exists before looking for peers
   var source = this.gang.casa.getSource(_oldPeerSource.fullName);

   if (source) {
      currentPriority = source.priority;
      topPriority = currentPriority;
   }

   var peerSource = this.gang.findNewPeerSource(_oldPeerSource.fullName, this);
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
      newMainSource.becomeMainSource(_oldPeerSource);
      this.gang.casa.refreshSourceListeners();
   }
};

PeerCasa.prototype.getSource = function(_sourceFullName) {
   return this.sources[_sourceFullName];
};

PeerCasa.prototype.bowSource = function(_source, _currentlyActive) {
   console.log(this.fullName + ": bowSource() Making source " + _source.fullName + " passive"); 

   if (_currentlyActive) {
      _source.detach();
   }
   this.bowingSources[_source.fullName] = _source;
}

PeerCasa.prototype.standUpSourceFromBow = function(_source) {
   console.log(this.fullName + ": standUpSourceFromBow() Making source " + _source.fullName + " active");

   if (!this.gang.addNamedObject(_source)) {
      console.error(this.fullName + ": standUpSourceFromBow() Unable to find owner for source=" + _source.fullName);
      return;
   }

   delete this.bowingSources[_source.fullName];
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

