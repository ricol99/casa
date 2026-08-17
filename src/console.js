var crypto = require('crypto');
var path = require('path');
var readline = require('readline');
var io = require('socket.io-client');
var util = require('./util');
var LocalConsole = require('./localconsole');
var AsyncEmitter = require('./asyncemitter');

function Console(_params, _owner) {
   this.secureMode = _params.secureMode;
   this.certPath = _params.certPath;
   this.gangName = _params.gangName;
   this.casaName = _params.casaName;
   this.remoteCasas = {};
   this.unregisteredCasas = {};
   this.offline = true;
   this.connectedCasas = 0;
   this.defaultCasa = null;
   this.sourceCasa =  null;
   this.activeWebUiOutputSocket = null;
   this.silentWebUiOutputCount = 0;
   this.webUiSockets = new Set();
   this.reconnectLogEnabled = (process.env.CASA_RECONNECT_LOG === "1");

   if (this.secureMode) {
      var fs = require('fs');
      this.http = "https";
      this.socketOptions = {
         secure: true,
         rejectUnauthorized: false,
         reconnection: false,
         key: fs.readFileSync(this.certPath+'/client.key'),
         cert: fs.readFileSync(this.certPath+'/client.crt'),
         ca: fs.readFileSync(this.certPath+'/ca.crt'),
         json: true
      };
   }
   else {
      this.http = "http";
      this.socketOptions = { reconnection: false, transports: ['websocket'], json: true };
   }

   LocalConsole.call(this, _owner);

   this.gang = this.owner;
}

util.inherits(Console, LocalConsole);

Console.prototype.coldStart = function() {

   var GangConsoleCmdObj = require("./consolecmds/gangconsolecmd");
   this.gangConsoleCmd = new GangConsoleCmdObj({ name: this.gang.name }, null, this);

   var casaDiscoveryServiceName = this.gang.casa.findServiceName("casadiscoveryservice");
   this.casaDiscoveryService = casaDiscoveryServiceName ? this.gang.casa.findService(casaDiscoveryServiceName) : null;
   this.casaDiscoveryService.setTargetCasa(this.casaName);

   this.casaFoundHandler = Console.prototype.casaFound.bind(this);
   this.casaDiscoveryService.on("casa-up", this.casaFoundHandler);

   this.casaLostHandler = Console.prototype.casaLost.bind(this);
   this.casaDiscoveryService.on("casa-down", this.casaLostHandler);

   util.setTimeout(() => {
      this.casaDiscoveryService.startSearching();
   }, 2000);

   this.registerWebUi();
   this.gang.casa.mainWebService.startListening();

   this.offlineCasa = new OfflineCasa({ name: "offlinecasa" }, this);

   this.start(":");
};

Console.prototype.registerWebUi = function() {
   var webUiPath = path.join(__dirname, 'webui');

   this.gang.casa.mainWebService.addRoute('/webui', (req, res) => {
      res.sendFile(path.join(webUiPath, 'marketing.html'));
   });

   this.gang.casa.mainWebService.addRoute('/webui/', (req, res) => {
      res.sendFile(path.join(webUiPath, 'marketing.html'));
   });

   this.gang.casa.mainWebService.addRoute('/webui/:filename', (req, res) => {
      res.sendFile(path.join(webUiPath, req.params.filename));
   });

   this.gang.casa.mainWebService.addIoRoute('/webuiapi/io', Console.prototype.webUiSocketConnected.bind(this));
};

Console.prototype.webUiSocketConnected = function(_socket) {
   this.webUiSockets.add(_socket);

   _socket.on('disconnect', (_reason) => {
      this.webUiSockets.delete(_socket);
      console.log(this.gang.casa.uName + ': webui socket disconnected, reason=' + _reason);
   });

   _socket.webUiState = {
      selectedCasa: null,
      currentScope: ":"
   };

   _socket.on('getWebUiStatus', (_data) => {
      this.emitWebUiStatus(_socket);
   });

   _socket.on('getUnregisteredCasas', (_data) => {
      _socket.emit('unregistered-casas-output', {
         id: _data && _data.id ? _data.id : null,
         ok: true,
         result: this.getUnregisteredCasas()
      });
   });

   _socket.on('addUnregisteredCasa', (_data) => {
      this.gangConsoleCmd.casas([ "add", "--name", _data ? _data.name : "", "--address", _data ? _data.address : "" ], (_err, _result) => {
         _socket.emit('add-unregistered-casa-output', {
            id: _data && _data.id ? _data.id : null,
            ok: !_err,
            result: _result,
            error: _err
         });
      });
   });

   _socket.on('getGangTopology', (_data) => {
      this.getGangTopology( (_err, _result) => {
         _socket.emit('gang-topology-output', {
            id: _data && _data.id ? _data.id : null,
            ok: !_err,
            result: _result,
            error: _err
         });
      });
   });

   _socket.on('setSelectedCasa', (_data) => {
      var requestedCasa = (_data && _data.selectedCasa) ? _data.selectedCasa : null;

      if (requestedCasa && this.remoteCasas.hasOwnProperty(requestedCasa) && this.remoteCasas[requestedCasa].connected) {
         _socket.webUiState.selectedCasa = requestedCasa;
      }
      else if (!requestedCasa) {
         _socket.webUiState.selectedCasa = null;
      }

      this.emitWebUiStatus(_socket);
   });

   _socket.on('setCurrentScope', (_data) => {
      var requestedScope = (_data && _data.currentScope) ? _data.currentScope.trim() : ':';
      requestedScope = requestedScope || ':';

      this.extractScopeForWebUi(_socket.webUiState.currentScope, requestedScope + ':', _socket.webUiState.selectedCasa, (_err, _result) => {
         _socket.webUiState.currentScope = requestedScope;

         if (!_err && _result) {
            this.updateWebUiSelectedCasaFromScopeResult(_socket.webUiState, _result);
         }

         this.emitWebUiStatus(_socket);
      });
   });

   _socket.on('autoComplete', (_data) => {
      this.autoCompleteWebUiLine(_data, _socket.webUiState, (_err, _result) => {
         _socket.emit('auto-complete-output', {
            id: _data && _data.id ? _data.id : null,
            ok: !_err,
            result: _result,
            error: _err
         });
      });
   });

   _socket.on('executeConsoleLine', (_data) => {
      this.executeWebUiConsoleLine(_data, _socket.webUiState, _socket, (_err, _result) => {
         _socket.emit('console-line-output', {
            id: _data && _data.id ? _data.id : null,
            ok: !_err,
            result: _result,
            error: _err
         });
      });
   });

   _socket.on('executeCommand', (_data) => {
      this.executeWebUiCommand(_data, _socket.webUiState.selectedCasa, (_err, _result) => {
         _socket.emit('execute-output', {
            id: _data && _data.id ? _data.id : null,
            ok: !_err,
            result: _result,
            error: _err
         });
      });
   });

};

Console.prototype.emitWebUiLiveUpdateToAll = function(_payload) {
   this.webUiSockets.forEach( (_socket) => {
      _socket.emit('webui-live-update', _payload);
   });
};

Console.prototype.emitWebUiStatus = function(_socket) {
   _socket.emit('webui-status', this.getWebUiStatus(_socket.webUiState.selectedCasa, _socket.webUiState.currentScope));
};

Console.prototype.emitWebUiStatusToAll = function() {
   this.webUiSockets.forEach( (_socket) => {
      this.emitWebUiStatus(_socket);
   });
};

Console.prototype.getWebUiStatus = function(_selectedCasaName, _currentScope) {
   var casaDb = this.gang.casa.getDb();
   var gangDb = this.gang.getDb();
   var selectedCasaName = _selectedCasaName;

   if (!selectedCasaName || !this.remoteCasas.hasOwnProperty(selectedCasaName) || !this.remoteCasas[selectedCasaName].connected) {
      selectedCasaName = this.defaultCasa ? this.defaultCasa.name : null;
   }

   return {
      gangName: this.gang.name,
      consoleCasaName: this.gang.casa.name,
      connectedCasas: this.connectedCasas,
      sourceCasa: this.sourceCasa ? this.sourceCasa.name : null,
      defaultCasa: this.defaultCasa ? this.defaultCasa.name : null,
      selectedCasa: selectedCasaName,
      currentScope: _currentScope ? _currentScope : ':',
      casas: this.getCasas(),
      unregisteredCasas: this.getUnregisteredCasas(),
      dbInfo: casaDb ? {
         dbName: casaDb.name,
         hash: casaDb.getHash().hash,
         lastModified: casaDb.getHash().lastModified
      } : null,
      gangDbInfo: gangDb ? {
         dbName: gangDb.name,
         hash: gangDb.getHash().hash,
         lastModified: gangDb.getHash().lastModified
      } : null
   };
};

Console.prototype.updateWebUiSelectedCasaFromScopeResult = function(_webUiState, _scopeResult) {
   if (!_webUiState || !_scopeResult) {
      return;
   }

   if (_scopeResult.sourceCasa &&
       this.remoteCasas.hasOwnProperty(_scopeResult.sourceCasa) &&
       this.remoteCasas[_scopeResult.sourceCasa].connected) {
      _webUiState.selectedCasa = _scopeResult.sourceCasa;
      return;
   }

   if (_scopeResult.consoleObjCasaName &&
       this.remoteCasas.hasOwnProperty(_scopeResult.consoleObjCasaName) &&
       this.remoteCasas[_scopeResult.consoleObjCasaName].connected) {
      _webUiState.selectedCasa = _scopeResult.consoleObjCasaName;
   }
};

Console.prototype.identifyCasaForWebUi = function(_selectedCasaName) {
   if (this.offline) {
      return this.offlineCasa;
   }

   if (_selectedCasaName && this.remoteCasas.hasOwnProperty(_selectedCasaName) && this.remoteCasas[_selectedCasaName].connected) {
      return this.remoteCasas[_selectedCasaName];
   }

   return this.defaultCasa;
};

Console.prototype.extractScopeForWebUi = function(_currentScope, _line, _selectedCasaName, _callback) {
   var casa = this.identifyCasaForWebUi(_selectedCasaName);

   if (!casa) {
      return _callback('No Casa connected!');
   }

   casa.extractScope(_line, (_err, _result) => {
      if (_err) {
         return _callback(_err);
      }

      if (!this.offline && _result && _result.consoleObjCasaName && (_result.consoleObjCasaName !== casa.name)) {
         if (!this.remoteCasas.hasOwnProperty(_result.consoleObjCasaName) || !this.remoteCasas[_result.consoleObjCasaName].connected) {
            return _callback('Object not available as not connected to owning casa!');
         }

         return this.remoteCasas[_result.consoleObjCasaName].extractScope(_line, _callback, _currentScope);
      }

      return _callback(null, _result);
   }, _currentScope);
};

Console.prototype.autoCompleteWebUiLine = function(_data, _webUiState, _callback) {
   var line = (_data && _data.line ? _data.line : '').trim();
   var currentScope = (_webUiState && _webUiState.currentScope) ? _webUiState.currentScope : ':';
   var selectedCasa = _webUiState ? _webUiState.selectedCasa : null;

   this.extractScopeForWebUi(currentScope, line, selectedCasa, (_err, _result) => {
      if (_err) {
         return _callback(_err);
      }

      var matches = (_result && _result.matchingScopes instanceof Array) ? _result.matchingScopes.slice() : [];
      var methodResult = this.extractMethodAndArguments(line, _result.remainingStr);
      var method = methodResult.method ? methodResult.method : '';

      if (_result && _result.consoleObjHierarchy) {
         matches = this.matchMethods(line,
                                     method,
                                     currentScope,
                                     _result.consoleObjHierarchy,
                                     _result.consoleObjuName,
                                     _result.consoleObjCasaName,
                                     _result.sourceCasa).concat(matches);
      }

      _callback(null, {
         currentScope: currentScope,
         matches: matches
      });
   });
};

Console.prototype.executeWebUiConsoleLine = function(_data, _webUiState, _socket, _callback) {
   if (typeof _socket === 'function') {
      _callback = _socket;
      _socket = null;
   }

   var rawLine = (_data && _data.line ? _data.line : '');
   var line = rawLine.trim();
   var currentScope = (_webUiState && _webUiState.currentScope) ? _webUiState.currentScope : ':';
   var selectedCasa = _webUiState ? _webUiState.selectedCasa : null;

   if (!line) {
      return _callback(null, { currentScope: currentScope, output: null });
   }

   if (line[line.length - 1] === ':') {
      return this.extractScopeForWebUi(currentScope, line, selectedCasa, (_err, _result) => {
         if (_err) {
            return _callback(_err);
         }

         if (_result && _result.consoleObjuName && _result.remainingStr === '') {
            _webUiState.currentScope = _result.consoleObjuName;
            this.updateWebUiSelectedCasaFromScopeResult(_webUiState, _result);
         }

         if (_socket) {
            this.emitWebUiStatus(_socket);
         }

         _callback(null, {
            currentScope: _webUiState.currentScope,
            selectedCasa: _webUiState.selectedCasa,
            output: null,
            scopeChanged: true
         });
      });
   }

   this.extractScopeForWebUi(currentScope, line, selectedCasa, (_err, _result) => {
      if (_err) {
         return _callback(_err);
      }

      var methodResult = this.extractMethodAndArguments(line, _result.remainingStr);

      if (methodResult.error) {
         return _callback(methodResult.error);
      }

      if (methodResult.method === 'exit') {
         return _callback('The browser console does not support exit.');
      }

      if (!methodResult.method || !_result.consoleObjHierarchy) {
         return _callback('Object not found!');
      }

      var cmdObj = this.getConsoleCmdObj(_result.consoleObjHierarchy,
                                         _result.consoleObjuName,
                                         _result.consoleObjCasaName,
                                         _result.sourceCasa);

      if (!cmdObj) {
         return _callback('Object not found!');
      }

      var cmdMethod = Object.getPrototypeOf(cmdObj)[methodResult.method];
      var previousOutputSocket = this.activeWebUiOutputSocket;

      if (!cmdMethod) {
         return _callback('Command not found!');
      }

      try {
         this.activeWebUiOutputSocket = _socket ? _socket : previousOutputSocket;
         cmdMethod.call(cmdObj, methodResult.arguments, (_commandErr, _commandResult) => {
            this.activeWebUiOutputSocket = previousOutputSocket;
            _callback(_commandErr, {
               currentScope: _webUiState.currentScope,
               output: _commandResult,
               scopeChanged: false
            });
         });
      }
      catch (_commandErr) {
         this.activeWebUiOutputSocket = previousOutputSocket;
         _callback(_commandErr);
      }
   });
};

Console.prototype.executeWebUiCommand = function(_params, _selectedCasaName, _callback) {
   var targetCasaName = _params ? _params.targetCasa : null;
   var obj = _params ? _params.obj : null;
   var method = _params ? _params.method : null;
   var arguments = (_params && _params.arguments instanceof Array) ? _params.arguments : [];
   var casa = null;

   if (!obj || !method) {
      return _callback("Malformed web UI command");
   }

   if (targetCasaName) {
      casa = this.remoteCasas.hasOwnProperty(targetCasaName) ? this.remoteCasas[targetCasaName] : null;

      if (!casa || !casa.connected) {
         return _callback("Target casa not connected");
      }
   }
   else {
      casa = this.identifyCasaForWebUi(_selectedCasaName);

      if (!casa) {
         return _callback("No default casa connected");
      }
   }

   this.silentWebUiOutputCount = this.silentWebUiOutputCount + 1;

   this.sendCommandToCasa(casa, [obj, method, arguments], "executeParsedCommand", (_err, _result) => {
      this.silentWebUiOutputCount = Math.max(0, this.silentWebUiOutputCount - 1);
      _callback(_err, _result);
   });
};

Console.prototype.getGangTopology = function(_callback) {
   this.sendCommandToAllCasasDetailed([":", "topology", []], "executeParsedCommand", (_err, _aggregate) => {

      if (_err) {
         return _callback(_err);
      }

      var rows = (_aggregate && _aggregate.results ? _aggregate.results : []).map( (_entry) => {
         var result = _entry.result ? _entry.result : null;
         var localCounts = result && result.localSourceCounts ? result.localSourceCounts : { total: 0, active: 0, bowed: 0, private: 0 };
         var localBowed = result && (typeof result.localBowed === "number") ? result.localBowed : (localCounts.bowed || 0);
         var peerActive = result && (typeof result.peerActive === "number") ? result.peerActive : 0;
         var peerBowed = result && (typeof result.peerBowed === "number") ? result.peerBowed : 0;

         return {
            casaName: _entry.casaName,
            connected: !!_entry.connected,
            active: _entry.ok ? ((localCounts.active || 0) + peerActive) : '-',
            owned: _entry.ok ? (localCounts.total || 0) : '-',
            ownedActive: _entry.ok ? (localCounts.active || 0) : '-',
            ownedBowed: _entry.ok ? localBowed : '-',
            peerActive: _entry.ok ? peerActive : '-',
            peerBowed: _entry.ok ? peerBowed : '-',
            privateCount: _entry.ok ? (localCounts.private || 0) : '-'
         };
      });

      _callback(null, {
         gangName: this.gang.name,
         casaCount: rows.length,
         connectedCasaCount: rows.reduce( (_count, _row) => _count + (_row.connected ? 1 : 0), 0),
         rows: rows
      });
   });
};

Console.prototype.getCasas = function() {
   var casas = [];

   for (var casa in this.remoteCasas) {

      if (this.remoteCasas.hasOwnProperty(casa)) {
         casas.push({name: this.remoteCasas[casa].name, connected: this.remoteCasas[casa].connected});
      }
   }
   return casas;
};

Console.prototype.getUnregisteredCasas = function() {
   var casas = [];

   for (var casa in this.unregisteredCasas) {

      if (this.unregisteredCasas.hasOwnProperty(casa)) {
         casas.push(this.unregisteredCasaOutput(this.unregisteredCasas[casa]));
      }
   }

   return casas;
};

Console.prototype.findUnregisteredCasaByAddress = function(_address) {
   var macAddress = util.normaliseMacAddress(_address);

   if (!macAddress) {
      return null;
   }

   for (var casa in this.unregisteredCasas) {

      if (this.unregisteredCasas.hasOwnProperty(casa) &&
          (util.normaliseMacAddress(this.unregisteredCasas[casa].macAddress) === macAddress)) {
         return this.unregisteredCasas[casa];
      }
   }

   return null;
};

Console.prototype.claimUnregisteredCasa = function(_params, _callback) {
   var unregisteredCasa = this.findUnregisteredCasaByAddress(_params ? _params.address : null);
   var macAddress = util.normaliseMacAddress(_params ? _params.address : null);
   var casaName = _params ? _params.name : null;

   if (!unregisteredCasa) {
      return _callback("Unable to find unregistered casa with address \"" + (_params ? _params.address : "") + "\"");
   }

   this.sendUnregisteredCasaClaim(unregisteredCasa, {
      casaName: casaName,
      gangName: this.gang ? this.gang.name : this.gangName,
      macAddress: macAddress
   }, _callback);
};

Console.prototype.waitForUnregisteredCasaConnection = function(_unregisteredCasa, _callback) {
   var remoteCasa = _unregisteredCasa ? _unregisteredCasa.remoteCasa : null;
   var timeoutMs = 5000;
   var start = Date.now();

   if (!remoteCasa) {
      return _callback("Unregistered casa \"" + (_unregisteredCasa ? _unregisteredCasa.name : "") + "\" has no remote connection");
   }

   var wait = () => {

      if (remoteCasa.connected) {
         return _callback(null, remoteCasa);
      }

      if (!remoteCasa.connecting) {
         remoteCasa.start();
      }

      if ((Date.now() - start) >= timeoutMs) {
         var error = "Unregistered casa \"" + _unregisteredCasa.name + "\" is not connected";

         if (_unregisteredCasa.lastError) {
            error = error + " (" + _unregisteredCasa.lastError + ")";
         }

         return _callback(error);
      }

      setTimeout(wait, 100);
   };

   wait();
};

Console.prototype.sendUnregisteredCasaClaim = function(_unregisteredCasa, _payload, _callback) {
   this.waitForUnregisteredCasaConnection(_unregisteredCasa, (_connectErr, _remoteCasa) => {

      if (_connectErr) {
         return _callback(_connectErr);
      }

      if (!_remoteCasa.executeParsedCommand([ _unregisteredCasa.name, "claimUnregisteredCasa", [ _payload ] ], (_err, _body) => {

         if (_err) {
            return _callback(_err);
         }

         if (typeof _body === "string") {
            return _callback(_body);
         }

         _callback(null, {
            casaName: _body ? _body.casaName : null,
            gangName: _body ? _body.gangName : null,
            macAddress: _body ? _body.macAddress : null,
            restartRequired: !!(_body && _body.restartRequired)
         });
      })) {
         return _callback("Unable to claim unregistered casa \"" + _unregisteredCasa.name + "\"");
      }
   });
};

Console.prototype.createUnregisteredRemoteCasa = function(_unregisteredCasa) {
   var remoteCasa = new RemoteCasa({
      name: _unregisteredCasa.name,
      address: _unregisteredCasa.address,
      messageTransportName: _unregisteredCasa.messageTransportName,
      tier: _unregisteredCasa.tier,
      autoReconnect: true,
      autoDbSync: false,
      requestCasaInfo: true,
      subscribeLiveUpdates: false
   }, this);

   return remoteCasa;
};

Console.prototype.connectUnregisteredCasa = function(_entry) {

   if (!_entry.remoteCasa) {
      _entry.remoteCasa = this.createUnregisteredRemoteCasa(_entry);

      _entry.remoteCasa.on("connected", () => {
         _entry.connected = true;
      });

      _entry.remoteCasa.on("disconnected", () => {
         _entry.connected = false;
      });

      _entry.remoteCasa.on("connect_error", (_data) => {
         _entry.connected = false;
         _entry.lastError = _data && _data.summary ? _data.summary : (_data && _data.error ? _data.error : _data);
      });
   }
   else {
      _entry.remoteCasa.address = _entry.address;
      _entry.remoteCasa.messageTransportName = _entry.messageTransportName;
      _entry.remoteCasa.discoveryTier = _entry.tier;
   }

   _entry.remoteCasa.start();
};

Console.prototype.removeUnregisteredCasa = function(_entry) {

   if (!_entry) {
      return;
   }

   if (_entry.remoteCasa) {
      _entry.remoteCasa.disconnect({ disableAutoReconnect: true, silent: true });
   }

   delete this.unregisteredCasas[_entry.name];
};

Console.prototype.casaObjUName = function(_remoteCasa) {
   var name = _remoteCasa ? _remoteCasa.name : "";

   if (!name) {
      return null;
   }

   return (name[0] === ":") ? name : ":" + name;
};

Console.prototype.writeDbSyncResult = function(_scope, _casaName, _err, _result) {

   if (_err) {
      this.writeOutput("Unable to sync " + _scope + " db from casa " + _casaName + ". Error=" + _err);
      return;
   }

   if (!_result) {
      return;
   }

   if (_result.action === "pulled") {
      this.writeOutput("Synced " + _scope + " db from casa " + _casaName + " (" + _result.reason + ")");
   }
   else if (_result.reason === "organisation-conflict") {
      this.writeOutput("Local gang db organisation (" + (_result.localOrganisation ? _result.localOrganisation : "not set") + ") differs from casa " + _casaName + " gang db (" + (_result.remoteOrganisation ? _result.remoteOrganisation : "not set") + "). Leaving local copy unchanged.");
   }
   else if (_result.reason === "local-newer") {
      this.writeOutput("Local " + _scope + " db is newer than casa " + _casaName + " db. Leaving local copy unchanged.");
   }
};

Console.prototype.findGangDocumentInDocs = function(_docs) {

   for (var i = 0; _docs && (i < _docs.length); ++i) {

      if ((_docs[i]._collection === "gang") && (_docs[i].name === this.gang.name)) {
         return _docs[i];
      }
   }

   return null;
};

Console.prototype.validateGangDbSyncDocs = function(_localDb, _remoteDocs, _state, _callback) {
   var remoteGangConfig = this.findGangDocumentInDocs(_remoteDocs);
   var remoteOrganisation = remoteGangConfig && remoteGangConfig.organisation ? remoteGangConfig.organisation : null;

   if (!_localDb || (typeof _localDb.find !== "function")) {
      return _callback(null, { shouldPull: true });
   }

   _localDb.find(this.gang.name, (_err, _localGangConfig) => {

      if (_err) {
         return _callback(_err);
      }

      var localOrganisation = _localGangConfig && _localGangConfig.organisation ? _localGangConfig.organisation : null;

      if (!localOrganisation && this.gang && (typeof this.gang.getOrganisation === "function")) {
         localOrganisation = this.gang.getOrganisation() ? this.gang.getOrganisation() : null;
      }

      if (localOrganisation && (localOrganisation !== remoteOrganisation)) {
         return _callback(null, {
            shouldPull: false,
            action: "skipped",
            reason: "organisation-conflict",
            localOrganisation: localOrganisation,
            remoteOrganisation: remoteOrganisation
         });
      }

      _callback(null, { shouldPull: true });
   });
};

Console.prototype.syncGangDbFromCasa = function(_remoteCasa, _callback) {
   var remoteDbInfo = _remoteCasa ? _remoteCasa.gangRemoteDbInfo : null;
   var localDb = this.gang.getDb();
   var dbName = remoteDbInfo && remoteDbInfo.dbName ? remoteDbInfo.dbName : (localDb ? localDb.name : this.gang.name + "-db");

   this.gangConsoleCmd.syncDbFromRemoteCasa({
      remoteCasa: _remoteCasa,
      remoteDbInfo: remoteDbInfo,
      localDb: localDb,
      dbName: dbName,
      objUName: ":",
      validateRemoteDocs: (_docs, _state, _done) => {
         this.validateGangDbSyncDocs(localDb, _docs, _state, _done);
      },
      afterWrite: (_db) => {
         this.gang.gangDb = _db;
         this.gang.dbs[dbName] = _db;
         this.refreshGangMetadataFromDb(_db);
      }
   }, _callback);
};

Console.prototype.refreshGangMetadataFromDb = function(_db) {

   if (!_db || (typeof _db.find !== "function")) {
      return;
   }

   _db.find(this.gang.name, (_err, _gangConfig) => {

      if (_err || !_gangConfig) {
         return;
      }

      if (_gangConfig.hasOwnProperty("organisation")) {
         this.gang.organisation = _gangConfig.organisation;
         this.gang.config.organisation = _gangConfig.organisation;
      }
   });
};

Console.prototype.syncCasaDbFromCasa = function(_remoteCasa, _callback) {
   var remoteDbInfo = _remoteCasa ? _remoteCasa.getRemoteDbInfo() : null;
   var localDb = _remoteCasa ? _remoteCasa.getDb() : null;
   var dbName = remoteDbInfo && remoteDbInfo.dbName ? remoteDbInfo.dbName : (_remoteCasa ? _remoteCasa.getDbName() : null);

   this.gangConsoleCmd.syncDbFromRemoteCasa({
      remoteCasa: _remoteCasa,
      remoteDbInfo: remoteDbInfo,
      localDb: localDb,
      dbName: dbName,
      objUName: this.casaObjUName(_remoteCasa),
      afterWrite: (_db) => {
         _remoteCasa.db = _db;
         this.gang.dbs[dbName] = _db;
      }
   }, _callback);
};

Console.prototype.syncDbsFromCasa = function(_remoteCasa) {

   if (!_remoteCasa || !_remoteCasa.connected) {
      return;
   }

   this.syncGangDbFromCasa(_remoteCasa, (_gangErr, _gangResult) => {
      this.writeDbSyncResult("gang", _remoteCasa.name, _gangErr, _gangResult);

      this.syncCasaDbFromCasa(_remoteCasa, (_casaErr, _casaResult) => {
         this.writeDbSyncResult("casa", _remoteCasa.name, _casaErr, _casaResult);
      });
   });
};

Console.prototype.setSourceCasa = function(_casaName, _callback) {
   //process.stdout.write("AAAAA Console.prototype.setSourceCasa() _casaName="+util.inspect(_casaName)+"\n");

   if (_casaName) {

      if (this.remoteCasas.hasOwnProperty(_casaName)) {
         this.sourceCasa = this.remoteCasas[_casaName];
      }
      else {
         return _callback("Unable to find casa!");;
      }
   }
   else {
      this.sourceCasa = null;
   }

   this.extractScope(this.currentScope+":", (_err, _result) => {

      if (!_err && _result.hasOwnProperty("consoleObjHierarchy") && _result.remainingStr === "") {
         this.currentCmdObj = this.getConsoleCmdObj(_result.consoleObjHierarchy, _result.consoleObjuName, _result.consoleObjCasaName, _result.sourceCasa);
         this.updatePrompt();
      }

      _callback(_err, true);
   });
};

Console.prototype.refreshConnectedCasaState = function() {
   var connectedCasas = this.getConnectedCasas();

   this.connectedCasas = connectedCasas.length;

   if (this.connectedCasas === 0) {
      this.offline = true;
      this.defaultCasa = null;
      this.currentScope = ":";
      this.currentCmdObj = this.gangConsoleCmd;
      this.sourceCasa = null;
      return connectedCasas;
   }

   this.offline = false;

   if (!this.defaultCasa || !this.defaultCasa.connected) {
      this.defaultCasa = this.remoteCasas[connectedCasas[0]];
   }

   if (this.sourceCasa && !this.sourceCasa.connected) {
      this.sourceCasa = null;
   }

   return connectedCasas;
};

Console.prototype.casaFound = function(_params) {

   if (_params && _params.metadata && _params.metadata.unregistered) {
      this.unregisteredCasaFound(_params);
      return;
   }

   if (!this.remoteCasas.hasOwnProperty(_params.name)) {
      var remoteCasa = new RemoteCasa(_params, this);
      this.remoteCasas[_params.name] = remoteCasa;

      remoteCasa.on("connected", (_data) => {
         this.refreshConnectedCasaState();
         this.updatePromptMidLine(_params.tier);
         this.emitWebUiStatusToAll();
      });

      remoteCasa.on("disconnected", (_data) => {

         if (_data && _data.hasOwnProperty("wasConnected") && !_data.wasConnected) {
            return;
         }

         this.refreshConnectedCasaState();
         this.updatePrompt();

         if (!_data.upgrading) {
            //this.writeOutput("Upgrading connectivity to casa "+_data.name+"...");
         //}
         //else {
            this.writeOutput("Casa "+_data.name+" disconnected");
         }
         this.emitWebUiStatusToAll();
      });

      remoteCasa.on("output", (_data) => {
         if (this.activeWebUiOutputSocket) {
            this.activeWebUiOutputSocket.emit('output', { result: this.processOutput(_data.result) });
         }
         else if (this.silentWebUiOutputCount > 0) {
         }
         else {
            this.writeOutput(this.processOutput(_data.result));
         }
      });

      remoteCasa.on("live-update", (_data) => {
         this.emitWebUiLiveUpdateToAll(_data);
      });

      remoteCasa.start();
   }
   else {
      this.remoteCasas[_params.name].reconnect(_params);
   }
};

Console.prototype.casaLost = function(_params) {

   if (_params && _params.metadata && _params.metadata.unregistered) {
      this.unregisteredCasaLost(_params);
   }
};

Console.prototype.unregisteredCasaFound = function(_params) {
   var entry;

   if (!_params || !_params.metadata || !_params.metadata.unregistered) {
      return;
   }

   entry = this.unregisteredCasas[_params.name] ? this.unregisteredCasas[_params.name] : {};

   entry.name = _params.name;
   entry.gang = _params.gang;
   entry.address = _params.address;
   entry.discoveryTransportName = _params.discoveryTransportName;
   entry.messageTransportName = _params.messageTransportName;
   entry.tier = _params.tier;
   entry.macAddress = _params.metadata.macAddress || null;
   entry.connected = entry.remoteCasa ? entry.remoteCasa.connected : false;

   this.unregisteredCasas[_params.name] = entry;
   this.connectUnregisteredCasa(entry);
};

Console.prototype.unregisteredCasaOutput = function(_entry) {
   return {
      name: _entry.name,
      gang: _entry.gang,
      address: _entry.address,
      discoveryTransportName: _entry.discoveryTransportName,
      messageTransportName: _entry.messageTransportName,
      tier: _entry.tier,
      macAddress: _entry.macAddress,
      connected: !!_entry.connected,
      connecting: !!(_entry.remoteCasa && _entry.remoteCasa.connecting),
      lastError: _entry.lastError
   };
};

Console.prototype.unregisteredCasaLost = function(_params) {
   var entry = _params ? this.unregisteredCasas[_params.name] : null;

   if (!_params || !_params.metadata || !_params.metadata.unregistered) {
      return;
   }

   this.removeUnregisteredCasa(entry);
};

Console.prototype.identifyCasa = function(_line) {

   if (this.offline) {
      return this.offlineCasa;
   }
   else if (this.sourceCasa) {
      return this.sourceCasa;
   }
   else if (this.remoteCasas.hasOwnProperty(this.currentCmdObj.casaName) &&
            this.remoteCasas[this.currentCmdObj.casaName].connected) {

      return this.remoteCasas[this.currentCmdObj.casaName];
   }
   else {
      return this.defaultCasa;
   }
};

Console.prototype.identifyCasaAndSendCommand = function(_line, _func, _callback) {
   var casa = this.identifyCasa(_line);
   //process.stdout.write("AAAAA Console.prototype.identifyCasaAndSendCommand() _line="+util.inspect(_line)+", _func="+_func+"\n");

   if (casa) {
      this.sendCommandToCasa(casa, _line, _func, _callback);
   }
   else {
      return _callback("No Casa connected!");
   }
};

Console.prototype.sendCommandToCasa = function(_casa, _line, _func, _callback) {
   //process.stdout.write("AAAAA Console.prototype.sendCommandToCasa() _line="+util.inspect(_line)+", _func="+_func+"\n");
   return Object.getPrototypeOf(_casa)[_func].call(_casa, _line, _callback);
};

Console.prototype.sendCommandToAllCasasDetailed = function(_line, _func, _callback) {
   //process.stdout.write("AAAAA Console.prototype.sendCommandToAllCasasDetailed() _line="+util.inspect(_line)+", _func="+_func+"\n");

   if (this.offline) {
      return this.sendCommandToCasa(this.offlineCasa, _line, _func, (_err, _result) => {
         _callback(null, {
            results: [ {
               casaName: this.offlineCasa.name,
               connected: true,
               ok: !_err,
               error: _err ? _err : null,
               result: _err ? null : _result
            } ]
         });
      });
   }

   if (this.allCasaCommandOngoing)  {
      return false;
   }

   this.allCasaCommandOngoing = true;

   var casaNames = Object.keys(this.remoteCasas).sort( (_a, _b) => _a.localeCompare(_b));
   var results = casaNames.map( (_casaName) => {
      var casa = this.remoteCasas[_casaName];

      return {
         casaName: _casaName,
         connected: !!(casa && casa.connected),
         ok: false,
         error: null,
         result: null
      };
   });
   var pendingResponses = 0;

   results.forEach( (_entry) => {
      var casa = this.remoteCasas[_entry.casaName];

      if (!casa || !_entry.connected) {
         return;
      }

      if (this.sendCommandToCasa(casa, _line, _func, (_err, _result) => {
         _entry.ok = !_err;
         _entry.error = _err ? _err : null;
         _entry.result = _err ? null : _result;
         pendingResponses = pendingResponses - 1;

         if (pendingResponses === 0) {
            this.allCasaCommandOngoing = false;
            _callback(null, { results: results });
         }
      })) {
         pendingResponses = pendingResponses + 1;
      }
   });

   if (pendingResponses === 0) {
      this.allCasaCommandOngoing = false;
      _callback(null, { results: results });
   }

   return true;
};

Console.prototype.sendCommandToAllCasas = function(_line, _func, _callback) {
   //process.stdout.write("AAAAA Console.prototype.sendCommandToAllCasas() _line="+util.inspect(_line)+", _func="+_func+"\n");

   return this.sendCommandToAllCasasDetailed(_line, _func, (_err, _aggregate) => {

      if (_err) {
         return _callback(_err);
      }

      var firstError = null;
      var lastResult = null;
      var hadConnectedTarget = false;

      (_aggregate && _aggregate.results ? _aggregate.results : []).forEach( (_entry) => {

         if (!_entry.connected) {
            return;
         }

         hadConnectedTarget = true;

         if (_entry.ok) {
            lastResult = _entry.result;
         }
         else if (!firstError && _entry.error) {
            firstError = _entry.error;
         }
      });

      if (!hadConnectedTarget) {
         return _callback("No Casa connected!");
      }

      _callback(firstError, lastResult);
   });
};

Console.prototype.scopeExists = function(_line, _callback) {
   this.identifyCasaAndSendCommand(_line, "scopeExists", _callback);
};

Console.prototype.extractScope = function(_line, _callback) {
   var casa = this.identifyCasa(_line);
   //process.stdout.write("AAAAA Console.prototype.extractScope() casa="+casa.name+"\n");

   if (casa) {
      this.sendCommandToCasa(casa, _line, "extractScope", (_err, _result) => {
         //process.stdout.write("AAAAA Console.prototype.extractScope() _result="+util.inspect(_result)+"\n");

         if (_err) {
            return _callback(_err);
         }

         if (!this.offline && !this.sourceCasa && _result.hasOwnProperty("consoleObjCasaName") && _result.consoleObjCasaName && (_result.consoleObjCasaName !== casa.name)) {
            // Object resides in a different casa - need to send request to owning casa

            if (!this.remoteCasas.hasOwnProperty(_result.consoleObjCasaName)) {
               return _callback("Object not available as not connected to owning casa!");
            }

            this.sendCommandToCasa(this.remoteCasas[_result.consoleObjCasaName], _line, "extractScope", _callback);
         }
         else {
            return _callback(_err, _result);
         }
      });
   }
   else {
      return _callback("No Casa connected!");
   }
};

Console.prototype.autoComplete = function(_line, _callback) {
   this.identifyCasaAndSendCommand(_line, "autoComplete", _callback);
};

Console.prototype.executeParsedCommand = function(_obj, _method, _arguments, _callback) {
   //process.stdout.write("AAAA Console.prototype.executeParsedCommand() _obj.casaName="+_obj.casaName+", _obj.uName="+_obj.uName+"\n");

   if (_obj.casaName) {

      if (this.remoteCasas.hasOwnProperty(_obj.casaName)) {
         this.sendCommandToCasa(this.remoteCasas[_obj.casaName], [_obj.uName, _method, _arguments], "executeParsedCommand", _callback);
      }
      else {
         return _callback("Owning Casa not connected");
      }
   }
   else {
      var casa = this.identifyCasa(_obj.uName);

      if (casa) {
         this.sendCommandToCasa(casa, [_obj.uName, _method, _arguments], "executeParsedCommand", _callback);
      }
      else {
         return _callback("No Casa connected");
      }
   }
};

Console.prototype.executeParsedCommandOnAllCasas = function(_obj, _method, _arguments, _callback) {
   this.sendCommandToAllCasas([_obj.uName, _method, _arguments], "executeParsedCommand", _callback);
};

Console.prototype.getConnectedCasas = function() {
   var connectedCasas = [];

   for (var casa in this.remoteCasas) {

     if (this.remoteCasas.hasOwnProperty(casa) && this.remoteCasas[casa].connected) {
        connectedCasas.push(casa);
     }
   }

   return connectedCasas;
};

Console.prototype.setPrompt = function(_prompt) {
   var colour = this.currentCmdObj ? (this.currentCmdObj.casaName === this.currentCmdObj.sourceCasa) ? "\x1b[32m" : "\x1b[31m" : "\x1b[31m";

   if (this.sourceCasa) {
      this.rl.setPrompt(colour + "[" + this.sourceCasa.name +":"+ this.connectedCasas + "] " + _prompt + " > \x1b[0m");
   }
   else {
      var cmdObj = this.gangConsoleCmd.findNamedObject(_prompt.split(" :")[0]);
      var cmdObjCasa = (cmdObj && cmdObj.sourceCasa &&
                        this.remoteCasas.hasOwnProperty(cmdObj.sourceCasa) &&
                        this.remoteCasas[cmdObj.sourceCasa].connected) ? cmdObj.sourceCasa : null;
      var casaName = cmdObjCasa ? cmdObjCasa : this.defaultCasa ? this.defaultCasa.name : "null";
      this.rl.setPrompt(colour + "[" + casaName + "*:" + this.connectedCasas + "] " + _prompt + " > \x1b[0m");
  }
};

Console.prototype.updatePrompt = function() {
   this.setPrompt(this.currentScope);
};

Console.prototype.updatePromptMidLine = function() {
   LocalConsole.prototype.setPromptMidLine.call(this, this.currentScope);
};

Console.prototype.getCasa = function(_name) {
   return this.remoteCasas[_name];
};

Console.prototype.getCurrentCasa = function() {
   return this.sourceCasa;
};

Console.prototype.dbCompare = function() {

   if (this.offline || !this.sourceCasa) {
      return 0;
   }

   var db = this.gang.getDb();
   var gangRemoteDbInfo = this.sourceCasa.gangRemoteDbInfo;

   if (!db || !db.getHash() || !gangRemoteDbInfo) {
      return -1;
   }

   var localHash = db.getHash();

   return (localHash.hash === gangRemoteDbInfo.hash) ? 0 : ((new Date(localHash.lastModified) > new Date(gangRemoteDbInfo.lastModified)) ? 1 : -1);
};

function RemoteCasa(_config, _owner) {
   AsyncEmitter.call(this);
   this.owner = _owner;
   this.name = _config.name;
   this.address = _config.address;
   this.messageTransportName = _config.messageTransportName;
   this.discoveryTier = _config.tier;
   this.db = null;
   this.remoteDbInfo = { dbName: "", hash: '', lastModified: new Date(0) };
   this.gangRemoteDbInfo = { dbName: "", hash: '', lastModified: new Date(0) };
   this.connected = false;
   this.connecting = false;
   this.reconnectDelayMs = _config.reconnectDelayMs ? _config.reconnectDelayMs : 5000;
   this.reconnectTimer = null;
   this.autoReconnectEnabled = _config.hasOwnProperty("autoReconnect") ? !!_config.autoReconnect : true;
   this.allowAutoReconnect = this.autoReconnectEnabled;
   this.autoDbSyncEnabled = _config.hasOwnProperty("autoDbSync") ? !!_config.autoDbSync : true;
   this.requestCasaInfoEnabled = _config.hasOwnProperty("requestCasaInfo") ? !!_config.requestCasaInfo : true;
   this.subscribeLiveUpdatesEnabled = _config.hasOwnProperty("subscribeLiveUpdates") ? !!_config.subscribeLiveUpdates : true;
   this.lastConnectErrorKey = null;
   this.lastConnectErrorTime = 0;
   this.dbInfoReady = false;
   this.gangDbInfoReady = false;
   this.autoDbSyncRequested = false;
}

util.inherits(RemoteCasa, AsyncEmitter);

RemoteCasa.prototype.clearReconnectTimer = function() {

   if (this.reconnectTimer) {
      util.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
   }
};

RemoteCasa.prototype.scheduleReconnect = function() {

   if (!this.allowAutoReconnect || this.reconnectTimer || this.connected || this.connecting) {
      return;
   }

   this.reconnectTimer = util.setTimeout(() => {
      this.reconnectTimer = null;

      if (this.allowAutoReconnect && !this.connected && !this.connecting) {
         this.start();
      }
   }, this.reconnectDelayMs);
};

RemoteCasa.prototype.requestAutoDbSync = function() {

   if (!this.autoDbSyncEnabled) {
      return;
   }

   if (this.autoDbSyncRequested || !this.dbInfoReady || !this.gangDbInfoReady) {
      return;
   }

   if (!this.remoteDbInfo.dbName || !this.gangRemoteDbInfo.dbName) {
      return;
   }

   this.autoDbSyncRequested = true;
   this.owner.syncDbsFromCasa(this);
};

RemoteCasa.prototype.start = function()  {
   if (this.connecting || this.connected) {
      return;
   }

   this.clearReconnectTimer();
   this.allowAutoReconnect = this.autoReconnectEnabled;
   this.connecting = true;
   this.socket = this.owner.gang.casa.mainWebService.newIoSocket(this.address, "/consoleapi/io", this.owner.secureMode, this.messageTransportName);

   this.socket.on('connect', (_data) => {
      this.connected = true;
      this.connecting = false;
      this.clearReconnectTimer();
      this.lastConnectErrorKey = null;
      this.lastConnectErrorTime = 0;
      this.dbInfoReady = false;
      this.gangDbInfoReady = false;
      this.autoDbSyncRequested = false;
      this.emit('connected', { name: this.name });

      if (this.requestCasaInfoEnabled) {
         this.socket.emit('getCasaInfo');
      }

      if (this.subscribeLiveUpdatesEnabled) {
         this.socket.emit('subscribeLiveUpdates', {});
      }
   });

   this.socket.on('casa-info', (_data) => {

      if (_data.hasOwnProperty("dbInfo")) {
         if (!_data.dbInfo) {
            this.dbInfoReady = true;
            this.requestAutoDbSync();
         }
         else {
            this.dbName = _data.dbInfo.dbName;
            this.remoteDbInfo = { dbName: _data.dbInfo.dbName, hash: _data.dbInfo.hash, lastModified: new Date(_data.dbInfo.lastModified) };

            this.owner.gang.getDb(this.dbName, undefined, (_err, _db, _data) => {

               if (_err) {
                  this.db = null;
               }
               else {
                  this.db = _db;
               }

               this.dbInfoReady = true;
               this.requestAutoDbSync();
            });
         }
      }
      else {
         this.owner.writeOutput("Casa "+this.name+" responded with a badly formatted information!");
      }

      if (_data.hasOwnProperty("gangDbInfo")) {
         if (!_data.gangDbInfo) {
            this.gangDbInfoReady = true;
            this.requestAutoDbSync();
         }
         else {
            this.gangRemoteDbInfo = { dbName: _data.gangDbInfo.dbName, hash: _data.gangDbInfo.hash, lastModified: new Date(_data.gangDbInfo.lastModified) };
            //this.owner.writeOutput("AAAAA gangDb.lastModified="+util.inspect(this.owner.gang.getDb().getHash().lastModified));
            //this.owner.writeOutput("AAAAA gangRemoteInfo.lastModified="+util.inspect(this.gangRemoteDbInfo.lastModified));
            this.gangDbInfoReady = true;
            this.requestAutoDbSync();
         }
      }
   });

   this.socket.on('connect_error', (_data) => {
      var data = (_data && (typeof _data === "object")) ? _data : { error: _data };
      data.name = this.name;
      var errDesc = data.description && (typeof data.description === "object") ? data.description : null;
      var errCode = errDesc && errDesc.code ? errDesc.code : (data.code ? data.code : "connect_error");
      var errAddress = errDesc && errDesc.address ? errDesc.address : (this.address ? this.address.host : "unknown-host");
      var errPort = errDesc && errDesc.port ? errDesc.port : (this.address ? this.address.port : "unknown-port");
      var errKey = errCode + ":" + errAddress + ":" + errPort;
      var now = Date.now();

      if ((this.lastConnectErrorKey !== errKey) || ((now - this.lastConnectErrorTime) >= 30000)) {
         this.lastConnectErrorKey = errKey;
         this.lastConnectErrorTime = now;
         data.summary = errCode + " " + errAddress + ":" + errPort;
         if (this.owner.reconnectLogEnabled || !this.autoReconnectEnabled) {
            this.emit('connect_error', data);
         }
      }

      this.connecting = false;
      this.scheduleReconnect();
   });

   this.socket.on('output', (_data) => {
      var data = (_data && (typeof _data === "object")) ? _data : { result: _data };
      data.name = this.name;
      this.emit('output', data);
   });

   this.socket.on('live-update', (_data) => {
      this.emit('live-update', {
         casaName: this.name,
         type: _data ? _data.type : null,
         data: _data ? _data.data : null
      });
   });

   this.socket.on('extract-tree-output', (_data) => {

      if (this.extractTreeCallback) {
         this.extractTreeCallback(null, _data);
      }
   });

   this.socket.on('scope-exists-output', (_data) => {

      if (this.scopeExistsCallback) {
         this.scopeExistsCallback(null, _data);
      }
   });

   this.socket.on('extract-scope-output', (_data) => {

      if (this.extractScopeCallback) {
         this.extractScopeCallback(null, _data.result);
      }
   });

   this.socket.on('execute-output', (_data) => {

      if (this.executeCallback) {
         this.executeCallback(null, _data.result);
      }
   });

   this.socket.on('disconnect', (_data) => {
      this.connecting = false;

      if (this.connected) {
         var wasConnected = this.connected;
         this.connected = false;
         this.emit('disconnected', { name: this.name, wasConnected: wasConnected });
      }

      this.scheduleReconnect();
   });

   this.socket.on('error', (_data) => {
      this.connecting = false;

      if (this.connected) {
         var wasConnected = this.connected;
         this.connected = false;
         this.emit('disconnected', { name: this.name, wasConnected: wasConnected });
      }
      else if (!this.autoReconnectEnabled) {
         this.emit('connect_error', { name: this.name, error: _data && _data.message ? _data.message : "socket error" });
      }

      this.scheduleReconnect();
   });
};

RemoteCasa.prototype.reconnect = function(_params) {

   if ((this.connecting || this.connected) && (_params.tier < this.discoveryTier)) {
      this.disconnect({ disableAutoReconnect: true });

      util.setTimeout( () => {
         this.allowAutoReconnect = this.autoReconnectEnabled;
         this.reconnect(_params);
      }, 3000);
   }
   else if (!this.connecting && !this.connected) { 
      this.address = _params.address;
      this.messageTransportName = _params.messageTransportName;
      this.discoveryTier = _params.tier;
      this.allowAutoReconnect = this.autoReconnectEnabled;
      this.start();
   }
};

RemoteCasa.prototype.disconnect = function(_params) {
   var disableAutoReconnect = _params && _params.disableAutoReconnect;
   var silent = _params && _params.silent;

   if (this.connected || this.connecting) {
      if (disableAutoReconnect) {
         this.allowAutoReconnect = false;
         this.clearReconnectTimer();
      }

      var wasConnected = this.connected;
      this.connected = false;
      this.connecting = false;
      this.socket.disconnect();

      if (!silent) {
         this.emit('disconnected', { name: this.name, upgrading: true, error: "Upgrading transport!", wasConnected: wasConnected });
      }
   }
};

RemoteCasa.prototype.getAddress = function() {
   return this.address;
};

RemoteCasa.prototype.getHost = function() {
   return this.address ? this.address.host : null;
};

RemoteCasa.prototype.getListeningPort = function() {
   return this.address ? this.address.port : 0;
};

RemoteCasa.prototype.getDb = function() {
   return this.db;
};

RemoteCasa.prototype.getDbName = function() {
   return this.dbName;
};

RemoteCasa.prototype.getRemoteDbInfo = function() {
   return this.remoteDbInfo;
};

RemoteCasa.prototype.dbCompare = function() {
   if (!this.db || !this.db.getHash() || !this.remoteDbInfo) {
      return -1;
   }

   var localHash = this.db.getHash();

   return (localHash.hash === this.remoteDbInfo.hash) ? 0 : ((new Date(localHash.lastModified) > new Date(this.remoteDbInfo.lastModified)) ? 1 : -1);
};

RemoteCasa.prototype.extractTree = function(_callback) {
   
   if (this.connected) {
      this.extractTreeCallback = _callback;
      this.socket.emit('extractTree', { scope: this.owner.currentScope });
      return true;
   }
   else {
      return false;
   }     
};    
   
RemoteCasa.prototype.scopeExists = function(_line, _callback) {
   var scope = arguments.length > 2 ? arguments[2] : this.owner.currentScope;

   if (this.connected) {
      this.scopeExistsCallback = _callback;
      this.socket.emit('scopeExists', { scope: scope, line: _line });
      return true;
   }
   else {
      return false;
   }
};

RemoteCasa.prototype.extractScope = function(_line, _callback) {
   var scope = arguments.length > 2 ? arguments[2] : this.owner.currentScope;

   if (this.connected) {
      this.extractScopeCallback = _callback;
      this.socket.emit('extractScope', { scope: scope, line: _line });
      return true;
   }
   else {
      return false;
   }
};

RemoteCasa.prototype.executeParsedCommand = function(_command, _callback) {

   if (this.connected) {
      this.executeCallback = _callback;
      this.socket.emit('executeCommand', { obj: _command[0], method: _command[1], arguments: _command[2] });
      return true;
   }
   else {
      return false;
   }
};

RemoteCasa.prototype.executeCommandLine = function(_command, _callback) {

   if (this.connected) {
      this.executeCallback = _callback;
      this.socket.emit('executeCommand', { scope: _command.scope, line: _command.line });
      return true;
   }
   else {
      return false;
   }
};

function OfflineCasa(_config, _owner) {
   this.owner = _owner;
   this.name = _config.name;
   this.db = this.owner.gang.getDb();

   var ConsoleCmdObj = require("./consolecmds/offlinecasaconsolecmd");
   this.cmdObj = new ConsoleCmdObj({ name: "offlinecasa", casaName: "offlinecasa", sourceCasa: "offlinecasa" }, this.owner.gangConsoleCmd, this.owner);
   this.methods = Object.getPrototypeOf(this.cmdObj);
}

OfflineCasa.prototype.extractTree = function(_callback) {

   if (_callback) {
      return _callback("Tree empty!");
   }
   else {
      return null;
   }
};

OfflineCasa.prototype.scopeExists = function(_line, _callback) {
   var gScope = _line.startsWith(":");

   if (_callback) {
      _callback(null, gScope ? (_line.substr(1).split("(")[0].indexOf(':') === -1) : (_line.split("(")[0].indexOf(':') === -1));
   }
   else {
      return gScope ? (_line.substr(1).split("(")[0].indexOf(':') === -1) : (_line.split("(")[0].indexOf(':') === -1);
   }
};

OfflineCasa.prototype.extractScope = function(_line, _callback) {

   if (!this.scopeExists(_line)) {

      if (_callback) {
         return _callback("Object does not exist!");
      }
      else {
         return null;
      }
   }

   if (_callback) {
      _callback(null, { remainingStr: _line.startsWith(":") ? _line.substr(1) : _line, matchingScopes: [], consoleObjHierarchy: [ "offlinecasaconsole" ], scope: ":", consoleObjuName: ":", consoleObjCasaName: null, sourceCasa: "offlinecasa" });
   }
   else {
      return { remainingStr: _line.startsWith(":") ? _line.substr(1) : _line, matchingScopes: [], consoleObjHierarchy: [ "offlinecasaconsole" ], scope: ":", consoleObjuName: ":", consoleObjCasaName: null, sourceCasa: "offlinecasa" };
   }
};

OfflineCasa.prototype.executeCommandLine = function(_command, _callback) {
   _callback('Casa is offline!');
};

OfflineCasa.prototype.executeParsedCommand = function(_command, _callback) {
   var obj = (_command && (_command.length > 0)) ? _command[0] : null;
   var method = (_command && (_command.length > 1)) ? _command[1] : null;
   var args = (_command && (_command[2] instanceof Array)) ? _command[2] : [];
   var commandObj = this.owner ? this.owner.gangConsoleCmd : null;

   if ((obj === ":") &&
       ((method === "organisation") || (method === "pusher")) &&
       commandObj &&
       (typeof commandObj[method] === "function")) {
      return Object.getPrototypeOf(commandObj)[method].call(commandObj, args, _callback);
   }

   _callback("Casa is offline!");
};

OfflineCasa.prototype.findMatchingMethod = function(_matchString) {
   var matchingMethods = [];

   for (var method in this.methods) {

      if (this.methods.hasOwnProperty(method) && method.startsWith(_matchString)) {
         matchingMethods.push(method);
      }
   }

   return matchingMethods;
};

OfflineCasa.prototype.getCasa = function(_name) {
   return this;
};

module.exports = exports = Console;
module.exports.__testExports = {
   RemoteCasa: RemoteCasa,
   OfflineCasa: OfflineCasa
};
