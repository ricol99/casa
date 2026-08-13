var util = require('util');
var NamedObject = require('./namedobject');
var Gang = require('./gang');
var Db = require('./db');

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

ConsoleCmd.prototype.casas = function(_arguments, _callback) {
   _callback(null, this.console.getCasas());
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
