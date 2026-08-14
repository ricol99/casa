var util = require('util');
var NamedObject = require('./namedobject');
var Gang = require('./gang');
var Db = require('./db');
var commandLineArgs = require('command-line-args');
var fs = require('fs');

function ConsoleCmd(_config, _owner, _console) {
   _config.transient = true;
   NamedObject.call(this, _config, _owner);

   this.casaName = _config.hasOwnProperty("casaName") ? _config.casaName : null;
   this.console = _console;
   this.gang = Gang.mainInstance();
   this.casa = this.console.getCasa(this.casaName);
   this.dbService = this.gang.casa.findService("dbservice");

   this.sourceCasa = _config.hasOwnProperty("sourceCasa") ? _config.sourceCasa :  null;
}

util.inherits(ConsoleCmd, NamedObject);

// Used to classify the type and understand where to load the javascript module
ConsoleCmd.prototype.superType = function(_type) {
   return "consolecmd";
};

// Called when current state required
ConsoleCmd.prototype.export = function(_exportObj) {
   NamedObject.prototype.export.call(this, _exportObj);
};

// Called when current state required
ConsoleCmd.prototype.import = function(_importObj) {
   NamedObject.prototype.import.call(this, _importObj);
};

ConsoleCmd.prototype.coldStart = function() {
   NamedObject.prototype.coldStart.call(this);
};

ConsoleCmd.prototype.hotStart = function() {
   NamedObject.prototype.hotStart.call(this);
};

ConsoleCmd.prototype.checkArguments = function(_minLength, _arguments) {

   if ((!_arguments && (_minLength > 0)) || (_arguments && (_arguments.length < _minLength)))  {
      throw("Not enough arguments");
   }
};

ConsoleCmd.prototype.executeParsedCommand = function(_method, _arguments, _callback) {
   this.console.executeParsedCommand(this, _method, _arguments, _callback);
};

ConsoleCmd.prototype.executeParsedCommandOnAllCasas = function(_method, _arguments, _callback) {

   this.console.executeParsedCommandOnAllCasas(this, _method, _arguments, (_err, _result) => {

      if (!_err && _result) {
         this.console.updatePrompt();
         return _callback(_err, _result);
      }
   });
};

ConsoleCmd.prototype.dbSyncState = function(_localDb, _remoteDbInfo) {

   if (!_remoteDbInfo || !_remoteDbInfo.dbName || !_remoteDbInfo.hash) {
      return { error: "Remote database information is not available" };
   }

   if (!_localDb || _localDb.consoleCreatedEmptyDb || !_localDb.getHash || !_localDb.getHash()) {
      return { shouldPull: true, reason: "local-missing" };
   }

   var localHash = _localDb.getHash();

   if (localHash.hash === _remoteDbInfo.hash) {
      return { shouldPull: false, reason: "same" };
   }

   if (new Date(_remoteDbInfo.lastModified) > new Date(localHash.lastModified)) {
      return { shouldPull: true, reason: "remote-newer" };
   }

   return { shouldPull: false, reason: "local-newer" };
};

ConsoleCmd.prototype.writeSyncedDb = function(_dbName, _docs, _callback) {

   if (!(_docs instanceof Array)) {
      return _callback("Remote exportDb did not return database documents");
   }

   var db = new Db(_dbName, this.gang.configPath(), true, null);

   db.on('connected', () => {
      var afterAppend = (_err) => {

         if (_err) {
            return _callback(_err);
         }

         db.updateHashInternal((_hashErr) => {

            if (_hashErr) {
               return _callback(_hashErr);
            }

            db.setOwner(this.gang);
            _callback(null, db);
         });
      };

      if (_docs.length === 0) {
         return afterAppend(null);
      }

      db.append(_docs, afterAppend);
   });

   db.on('error', (_data) => {
      _callback(_data && _data.error ? _data.error : "Unable to write database");
   });

   db.on('connect-error', (_data) => {
      _callback(_data && _data.error ? _data.error : "Unable to create database");
   });

   db.connect();
};

ConsoleCmd.prototype.finishDbSyncPull = function(_dbName, _docs, _state, _afterWrite, _callback) {

   this.writeSyncedDb(_dbName, _docs, (_writeErr, _db) => {

      if (_writeErr) {
         return _callback(_writeErr);
      }

      if (_afterWrite) {
         _afterWrite(_db);
      }

      _callback(null, {
         dbName: _dbName,
         action: "pulled",
         reason: _state.reason,
         hash: _db.getHash()
      });
   });
};

ConsoleCmd.prototype.dbPushPayload = function(_db, _callback) {

   if (!_db || (typeof _db.readAll !== "function")) {
      return _callback("Database is not available");
   }

   _db.readAll((_err, _docs) => {

      if (_err) {
         return _callback(_err);
      }

      _callback(null, {
         dbName: _db.name,
         hash: (typeof _db.getHash === "function") ? _db.getHash() : null,
         docs: _docs
      });
   });
};

ConsoleCmd.prototype.dbPushPayloads = function(_dbs, _callback) {
   var payloads = [];

   if (!(_dbs instanceof Array) || (_dbs.length === 0)) {
      return _callback("No databases available to push");
   }

   var addPayload = (_index) => {

      if (_index >= _dbs.length) {
         return _callback(null, payloads);
      }

      this.dbPushPayload(_dbs[_index], (_err, _payload) => {

         if (_err) {
            return _callback(_err);
         }

         payloads.push(_payload);
         addPayload(_index + 1);
      });
   };

   addPayload(0);
};

ConsoleCmd.prototype.syncDbFromRemoteCasa = function(_options, _callback) {
   var remoteCasa = _options ? _options.remoteCasa : null;
   var remoteDbInfo = _options ? _options.remoteDbInfo : null;
   var localDb = _options ? _options.localDb : null;
   var dbName = _options && _options.dbName ? _options.dbName : (remoteDbInfo ? remoteDbInfo.dbName : null);
   var objUName = _options && _options.objUName ? _options.objUName : this.uName;
   var afterWrite = _options ? _options.afterWrite : null;
   var validateRemoteDocs = _options ? _options.validateRemoteDocs : null;
   var state = this.dbSyncState(localDb, remoteDbInfo);

   if (!remoteCasa || !remoteCasa.connected) {
      return _callback("Remote casa is not connected");
   }

   if (!dbName) {
      return _callback("Database name is not available");
   }

   if (state.error) {
      return _callback(state.error);
   }

   if (!state.shouldPull) {
      return _callback(null, {
         dbName: dbName,
         action: state.reason === "same" ? "unchanged" : "skipped",
         reason: state.reason
      });
   }

   this.console.sendCommandToCasa(remoteCasa, [ objUName, "exportDb", [] ], "executeParsedCommand", (_err, _docs) => {

      if (_err) {
         return _callback(_err);
      }

      if (validateRemoteDocs) {
         return validateRemoteDocs(_docs, state, (_validationErr, _validationResult) => {

            if (_validationErr) {
               return _callback(_validationErr);
            }

            if (_validationResult && (_validationResult.shouldPull === false)) {
               return _callback(null, {
                  dbName: dbName,
                  action: _validationResult.action ? _validationResult.action : "skipped",
                  reason: _validationResult.reason ? _validationResult.reason : state.reason,
                  localOrganisation: _validationResult.localOrganisation,
                  remoteOrganisation: _validationResult.remoteOrganisation
               });
            }

            this.finishDbSyncPull(dbName, _docs, state, afterWrite, _callback);
         });
      }

      this.finishDbSyncPull(dbName, _docs, state, afterWrite, _callback);
   });
};

ConsoleCmd.prototype.parseCasasArgs = function(_arguments) {
   var subCommand = (_arguments && (_arguments.length > 0)) ? _arguments[0] : "show";
   var options;

   if (subCommand === "show") {
      return this.parseCasasShowArgs(_arguments ? _arguments.slice(1) : []);
   }
   else if (subCommand === "add") {
      return this.parseCasasAddArgs(_arguments ? _arguments.slice(1) : []);
   }

   return { error: "Unsupported casas command \"" + subCommand + "\". Usage: casas show [--unregistered] | casas add --name <name> --address <mac-address>" };
};

ConsoleCmd.prototype.parseCasasShowArgs = function(_arguments) {
   var options;

   try {
      options = commandLineArgs([
         { name: 'unregistered', type: Boolean }
      ], { argv: _arguments, stopAtFirstUnknown: true });
   }
   catch (_err) {
      return { error: _err.message ? _err.message : "Unable to parse casas command" };
   }

   if (options._unknown && (options._unknown.length > 0)) {
      return { error: "Too many arguments. Usage: casas show [--unregistered]" };
   }

   return { command: "show", unregistered: options.unregistered === true };
};

ConsoleCmd.prototype.parseCasasAddArgs = function(_arguments) {
   var options;

   try {
      options = commandLineArgs([
         { name: 'name', type: String },
         { name: 'address', type: String }
      ], { argv: _arguments, stopAtFirstUnknown: true });
   }
   catch (_err) {
      return { error: _err.message ? _err.message : "Unable to parse casas command" };
   }

   if (options._unknown && (options._unknown.length > 0)) {
      return { error: "Too many arguments. Usage: casas add --name <name> --address <mac-address>" };
   }

   if (!options.name) {
      return { error: "Casa name not provided. Usage: casas add --name <name> --address <mac-address>" };
   }

   if (!options.address) {
      return { error: "Casa address not provided. Usage: casas add --name <name> --address <mac-address>" };
   }

   return { command: "add", name: options.name, address: options.address };
};

ConsoleCmd.prototype.casas = function(_arguments, _callback) {
   var params = this.parseCasasArgs(_arguments);

   if (params.error) {
      return _callback(params.error);
   }

   if (params.unregistered) {
      if (typeof this.console.getUnregisteredCasas !== "function") {
         return _callback(null, []);
      }

      return _callback(null, this.console.getUnregisteredCasas());
   }

   if (params.command === "add") {
      return this.addCasa(params, _callback);
   }

   _callback(null, this.console.getCasas());
};

ConsoleCmd.prototype.unregisteredCasaAddressSummary = function() {
   var casas = (this.console && (typeof this.console.getUnregisteredCasas === "function")) ?
      this.console.getUnregisteredCasas() : [];
   var addresses = [];

   for (var i = 0; casas && (i < casas.length); ++i) {

      if (casas[i].macAddress) {
         addresses.push(casas[i].macAddress);
      }
   }

   return addresses.length > 0 ? addresses.join(", ") : null;
};

ConsoleCmd.prototype.addCasa = function(_params, _callback) {
   var unregisteredCasa = (this.console && (typeof this.console.findUnregisteredCasaByAddress === "function")) ?
      this.console.findUnregisteredCasaByAddress(_params.address) : null;

   if (!unregisteredCasa) {
      var knownAddresses = this.unregisteredCasaAddressSummary();
      var error = "Unable to find unregistered casa with address \"" + _params.address + "\"";

      if (knownAddresses) {
         error = error + ". Known unregistered addresses: " + knownAddresses;
      }

      return _callback(error);
   }

   this.console.claimUnregisteredCasa(_params, (_claimErr, _claimResult) => {

      if (_claimErr) {
         return _callback(_claimErr);
      }

      this.pushBootstrapDbsToUnregisteredCasa(unregisteredCasa, _params.name, (_pushErr, _pushResult) => {

         if (_pushErr) {
            return _callback(_pushErr);
         }

         this.restartUnregisteredCasa(unregisteredCasa, (_restartErr, _restartResult) => {

            if (_restartErr) {
               return _callback(_restartErr);
            }

            if (this.console && (typeof this.console.removeUnregisteredCasa === "function")) {
               this.console.removeUnregisteredCasa(unregisteredCasa);
            }

            _callback(null, {
               casaName: _claimResult ? _claimResult.casaName : _params.name,
               gangName: _claimResult ? _claimResult.gangName : (this.gang ? this.gang.name : null),
               macAddress: _claimResult ? _claimResult.macAddress : _params.address,
               dbsPushed: true,
               dbResult: _pushResult,
               restartOrdered: true
            });
         });
      });
   });
};

ConsoleCmd.prototype.pushBootstrapDbsToUnregisteredCasa = function(_unregisteredCasa, _casaName, _callback) {

   this.bootstrapDbPayloads(_unregisteredCasa, _casaName, (_payloadErr, _payloads) => {

      if (_payloadErr) {
         return _callback(_payloadErr);
      }

      this.console.sendCommandToCasa(_unregisteredCasa.remoteCasa, [ _unregisteredCasa.name, "replaceDbs", [ _payloads ] ], "executeParsedCommand", _callback);
   });
};

ConsoleCmd.prototype.bootstrapDbPayloads = function(_unregisteredCasa, _casaName, _callback) {

   this.dbPushPayload(this.gang.getDb(), (_gangErr, _gangPayload) => {

      if (_gangErr) {
         return _callback(_gangErr);
      }

      this.bootstrapCasaDbPayload(_unregisteredCasa, _casaName, (_casaErr, _casaPayload) => {

         if (_casaErr) {
            return _callback(_casaErr);
         }

         _callback(null, [ _gangPayload, _casaPayload ]);
      });
   });
};

ConsoleCmd.prototype.bootstrapCasaDbName = function(_casaName) {
   return this.normaliseCasaName(_casaName) + "-db";
};

ConsoleCmd.prototype.normaliseCasaName = function(_casaName) {
   var casaName = _casaName ? _casaName.trim() : "";

   if (casaName[0] === ":") {
      casaName = casaName.slice(1);
   }

   return casaName;
};

ConsoleCmd.prototype.bootstrapCasaDbPath = function(_dbName) {
   return this.gang.configPath() + "/" + _dbName + ".db";
};

ConsoleCmd.prototype.bootstrapCasaDbPayload = function(_unregisteredCasa, _casaName, _callback) {
   var dbName = this.bootstrapCasaDbName(_casaName);
   var existingDb = this.gang.getDb(dbName);

   if (existingDb) {
      return this.dbPushPayload(existingDb, _callback);
   }

   if (fs.existsSync(this.bootstrapCasaDbPath(dbName))) {
      return this.gang.getDb(dbName, null, (_err, _db) => {

         if (_err) {
            return _callback(_err);
         }

         this.dbPushPayload(_db, _callback);
      });
   }

   this.createBootstrapCasaDb(_unregisteredCasa, _casaName, dbName, (_createErr, _db) => {

      if (_createErr) {
         return _callback(_createErr);
      }

      this.dbPushPayload(_db, _callback);
   });
};

ConsoleCmd.prototype.createBootstrapCasaDb = function(_unregisteredCasa, _casaName, _dbName, _callback) {
   var casaName = this.normaliseCasaName(_casaName);
   var docs = [ {
      _collection: "casa",
      _id: casaName,
      name: casaName,
      type: "casa",
      displayName: casaName,
      location: {},
      listeningPort: (_unregisteredCasa && _unregisteredCasa.address) ? _unregisteredCasa.address.port : 8999,
      gang: this.gang.name
   } ];

   this.writeSyncedDb(_dbName, docs, (_writeErr, _db) => {

      if (_writeErr) {
         return _callback(_writeErr);
      }

      this.gang.dbs[_dbName] = _db;
      _callback(null, _db);
   });
};

ConsoleCmd.prototype.restartUnregisteredCasa = function(_unregisteredCasa, _callback) {
   var remoteCasa = _unregisteredCasa ? _unregisteredCasa.remoteCasa : null;
   var callbackCalled = false;
   var callbackOnce = (_err, _result) => {

      if (callbackCalled) {
         return;
      }

      callbackCalled = true;
      _callback(_err, _result);
   };

   if (!remoteCasa || !remoteCasa.connected) {
      return _callback("Unregistered casa \"" + (_unregisteredCasa ? _unregisteredCasa.name : "") + "\" is not connected");
   }

   if (!remoteCasa.executeParsedCommand([ _unregisteredCasa.name, "restart", [ true ] ], (_err) => {

      if (_err) {
         return callbackOnce(_err);
      }

      callbackOnce(null, true);
   })) {
      return _callback("Unable to order restart for unregistered casa \"" + _unregisteredCasa.name + "\"");
   }

   setTimeout(() => {
      callbackOnce(null, true);
   }, 250);
};

ConsoleCmd.prototype.cc = function(_arguments, _callback) {
   this.console.setSourceCasa((_arguments && _arguments.length === 1) ? _arguments[0] : null, _callback);
};

ConsoleCmd.prototype.quit = function(_arguments, _callback) {
   this.checkArguments(0, _arguments);
   process.exit(1);
};

ConsoleCmd.prototype.exit = function(_arguments, _callback) {
   this.checkArguments(0, _arguments);
   process.exit(1);
};

ConsoleCmd.prototype.cat = function(_arguments, _callback) {
   this.checkArguments(0, _arguments);
   this.executeParsedCommand("cat", [], _callback);
};

ConsoleCmd.prototype.ls = function(_arguments, _callback) {
   this.checkArguments(0, _arguments);
   this.executeParsedCommand("ls", [], _callback);
};

ConsoleCmd.prototype.tree = function(_arguments, _callback) {
   this.checkArguments(0, _arguments);
   var params = (_arguments && arguments.length > 0) ? _arguments : [];
   this.executeParsedCommand("tree", params, _callback);
};

ConsoleCmd.prototype.filterArray = function(_array, _filter) {

   for (var i = 0; i < _array.length;) {

      if (_array[i].startsWith(_filter)) {
         ++i;
      }
      else {
         _array.splice(i, 1);
      }
   }
};

ConsoleCmd.prototype.filterMembers = function(_filter, _previousMatches, _fullScopeName) {
   var proto = Object.getPrototypeOf(this);
   var consoleCmdProto = proto;
   var fullScope = (_fullScopeName) ? _fullScopeName + ":" : "";
   //process.stdout.write("AAAAA fullScope= "+fullScope+"\n");

   while (consoleCmdProto.constructor.name !== 'ConsoleCmd') {
      consoleCmdProto = Object.getPrototypeOf(consoleCmdProto);
   }

   var members = _previousMatches ? _previousMatches : [];
   var excObj = {};

   //process.stdout.write("AAAAA proto of obj = "+util.inspect(proto)+"\n");
   //process.stdout.write("AAAAA proto of ConsoleCmd = "+util.inspect(consoleCmdProto)+"\n");

   while (proto.constructor.name !== 'ConsoleCmd') {

      for (var method in proto) {

         if (proto.hasOwnProperty(method)) {
            //process.stdout.write("AAAAA method name = "+method+"\n");

            if (!consoleCmdProto.hasOwnProperty(method) && !method.startsWith("_")) {
               excObj[fullScope+method] = true;
               //members.push(fullScope+method);
               //process.stdout.write("AAAAA method "+fullScope+method+" Added\n");
            }
         }
      }

      proto = Object.getPrototypeOf(proto);
   }

   for (var member in excObj) {

      if (excObj.hasOwnProperty(member)) {
         members.push(member);
      }
   }

   members.push(fullScope+"casas");
   members.push(fullScope+"cc");
   members.push(fullScope+"ls");
   members.push(fullScope+"cat");
   members.push(fullScope+"quit");
   members.push(fullScope+"exit");
   members.push(fullScope+"tree");

   this.filterArray(members, fullScope+_filter);
   return members;
};

module.exports = exports = ConsoleCmd;
