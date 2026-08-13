var ConsoleCmd = require('../consolecmd');
var util = require('util');
var commandLineArgs = require('command-line-args');
var fs = require('fs');
var JSON5 = require('json5');

function GangConsoleCmd(_config, _owner, _console) {
   ConsoleCmd.call(this, _config, _owner, _console);
}

util.inherits(GangConsoleCmd, ConsoleCmd);

function parseSourceCommandArgs(_arguments) {
   var definitions = [
      { name: 'sourceUName', defaultOption: true, type: String },
      { name: 'casa', alias: 'c', type: String }
   ];
   var options;

   try {
      options = commandLineArgs(definitions, { argv: _arguments, stopAtFirstUnknown: true });
   }
   catch (_err) {
      return { error: _err.message ? _err.message : "Unable to parse command arguments" };
   }

   if (!options.sourceUName) {
      return { error: "Source uName not provided" };
   }

   if (options._unknown && options._unknown.length > 0) {
      return { error: "Too many arguments. Usage: <sourceUName> [--casa <name>]" };
   }

   return { sourceUName: options.sourceUName, casaName: options.casa };
}

function parseSourceUsageArgs(_arguments) {
   var definitions = [
      { name: 'sourceUName', defaultOption: true, type: String },
      { name: 'activeOnly', alias: 'a', type: Boolean },
      { name: 'hasConsumers', alias: 'h', type: Boolean },
      { name: 'casa', alias: 'c', type: String }
   ];
   var options;

   try {
      options = commandLineArgs(definitions, { argv: _arguments, stopAtFirstUnknown: true });
   }
   catch (_err) {
      return { error: _err.message ? _err.message : "Unable to parse command arguments" };
   }

   if (!options.sourceUName) {
      return { error: "Source uName not provided" };
   }

   if (options._unknown && options._unknown.length > 0) {
      return { error: "Too many arguments. Usage: sourceUsage <sourceUName> [--activeOnly] [--hasConsumers] [--casa <name>]" };
   }

   return {
      sourceUName: options.sourceUName,
      casaName: options.casa,
      params: [ options.sourceUName, { activeOnly: !!options.activeOnly, hasConsumers: !!options.hasConsumers } ]
   };
}

function parsePreviewConfigArgs(_arguments) {
   var definitions = [
      { name: 'patch', defaultOption: true, type: String },
      { name: 'file', alias: 'f', type: String },
      { name: 'include', alias: 'i', multiple: true, type: String },
      { name: 'usage', type: Boolean },
      { name: 'limit', alias: 'l', type: Number },
      { name: 'progress', type: Boolean },
      { name: 'summaryOnly', type: Boolean },
      { name: 'topChanged', type: Number },
      { name: 'casa', alias: 'c', type: String }
   ];
   var options;

   try {
      options = commandLineArgs(definitions, { argv: _arguments, stopAtFirstUnknown: true });
   }
   catch (_err) {
      return { error: _err.message ? _err.message : "Unable to parse command arguments" };
   }

   if (options._unknown && options._unknown.length > 0) {
      return { error: "Too many arguments. Usage: previewConfig <jsonPatch> [--file <path>] [--include usage] [--limit <n>] [--progress] [--summaryOnly] [--topChanged <n>] [--casa <name>]" };
   }

   if (!options.patch && !options.file) {
      return { error: "No patch provided. Use inline JSON patch or --file <path>." };
   }

   if (options.patch && options.file) {
      return { error: "Specify either inline patch or --file, not both." };
   }

   var patchObj = null;

   try {

      if (options.file) {
         patchObj = JSON5.parse(fs.readFileSync(options.file, 'utf8'));
      }
      else {
         patchObj = JSON5.parse(options.patch);
      }
   }
   catch (_err2) {
      return { error: "Unable to parse patch: " + (_err2.message ? _err2.message : _err2) };
   }

   var includeUsage = !!options.usage;

   if (options.include instanceof Array) {

      for (var i = 0; i < options.include.length; ++i) {
         var token = String(options.include[i]).toLowerCase();

         if ((token === "usage") || (token === "all")) {
            includeUsage = true;
         }
      }
   }

   return {
      casaName: options.casa,
      params: [ {
         patch: patchObj,
         includeUsage: includeUsage,
         limit: options.limit,
         progress: !!options.progress,
         summaryOnly: !!options.summaryOnly,
         topChanged: options.topChanged,
         targetCasaName: options.casa
      } ]
   };
}

function parseSourceTreesArgs(_arguments) {
   var definitions = [
      { name: 'casa', alias: 'c', type: String }
   ];
   var options;

   try {
      options = commandLineArgs(definitions, { argv: _arguments ? _arguments : [], stopAtFirstUnknown: true });
   }
   catch (_err) {
      return { error: _err.message ? _err.message : "Unable to parse command arguments" };
   }

   if (options._unknown && options._unknown.length > 0) {
      return { error: "Too many arguments. Usage: sourceTrees [--casa <name>]" };
   }

   return { casaName: options.casa };
}

function executeOnSpecificCasaWithParams(_self, _method, _casaName, _params, _callback) {

   if (!_casaName) {
      return _self.executeParsedCommand(_method, _params, _callback);
   }

   var casa = _self.console.getCasa(_casaName);

   if (!casa) {
      return _callback("Unable to find casa \"" + _casaName + "\"");
   }

   if (!casa.connected) {
      return _callback("Casa \"" + _casaName + "\" is not connected");
   }

   return _self.console.sendCommandToCasa(casa, [ _self.uName, _method, _params ], "executeParsedCommand", _callback);
}

function executeOnActiveSourceOwnerCasa(_self, _method, _sourceUName, _methodParams, _callback) {
   var sourceParams = [ _sourceUName ];
   var methodParams = (_methodParams && (_methodParams.length > 0)) ? _methodParams : sourceParams;
   var canRouteToSpecificCasa = !!(_self.console && (typeof _self.console.sendCommandToCasa === "function"));

   _self.executeParsedCommand("resolveSource", sourceParams, (_err, _resolved) => {

      if (_err) {
         return _callback(_err);
      }

      if (!_resolved || !_resolved.exists || !_resolved.activeOwnerCasa) {
         return _self.executeParsedCommand(_method, methodParams, _callback);
      }

      var activeCasaName = _resolved.activeOwnerCasa;
      var activeCasa = _self.console.getCasa(activeCasaName);
      var activeCasaConnected = !!(activeCasa && ((activeCasa.connected === undefined) || activeCasa.connected));

      if (canRouteToSpecificCasa && activeCasaConnected) {
         return _self.console.sendCommandToCasa(activeCasa, [ _self.uName, _method, methodParams ], "executeParsedCommand", _callback);
      }

      if (canRouteToSpecificCasa && _self.console && (typeof _self.console.write === "function")) {
         _self.console.write("Warning: active owner casa \"" + activeCasaName + "\" is not connected. Falling back to current casa.");
      }

      return _self.executeParsedCommand(_method, methodParams, _callback);
   });
}

function executeOnSpecificCasa(_self, _method, _parsed, _callback) {
   var methodParams = (_parsed.params && (_parsed.params.length > 0)) ? _parsed.params : [ _parsed.sourceUName ];

   if (_parsed.casaName) {
      return executeOnSpecificCasaWithParams(_self, _method, _parsed.casaName, methodParams, _callback);
   }

   return executeOnActiveSourceOwnerCasa(_self, _method, _parsed.sourceUName, methodParams, _callback);
}

// Called when current state required
GangConsoleCmd.prototype.export = function(_exportObj) {
   ConsoleCmd.prototype.export.call(this, _exportObj);
};

// Called to restore current state
GangConsoleCmd.prototype.import = function(_importObj) {
   ConsoleCmd.prototype.import.call(this, _importObj);
};

GangConsoleCmd.prototype.coldStart = function() {
   ConsoleCmd.prototype.coldStart.call(this);
};

GangConsoleCmd.prototype.hotStart = function() {
   ConsoleCmd.prototype.hotStart.call(this);
};

GangConsoleCmd.prototype.updateGangDbHash = function(_callback) {
   var db = this.gang.getDb();

   if (!db || (typeof db.updateHashInternal !== "function")) {
      return _callback("Gang database is not available");
   }

   db.updateHashInternal(_callback);
};

GangConsoleCmd.prototype.findGangDocument = function(_callback) {
   var db = this.gang.getDb();

   if (!db || (typeof db.find !== "function")) {
      return _callback("Gang database is not available");
   }

   db.find(this.gang.name, _callback);
};

GangConsoleCmd.prototype.upsertGangDocument = function(_updates, _callback) {
   var db = this.gang.getDb();

   this.findGangDocument((_err, _document) => {
      var document = _document ? _document : { name: this.gang.name, type: "gang" };

      if (_err && _document !== null) {
         return _callback(_err);
      }

      for (var key in _updates) {

         if (_updates.hasOwnProperty(key)) {
            document[key] = _updates[key];
         }
      }

      if (_document) {
         db.update(document, (_updateErr) => {

            if (_updateErr) {
               return _callback(_updateErr);
            }

            db.consoleCreatedEmptyDb = false;
            this.updateGangDbHash(( _hashErr) => _callback(_hashErr, document));
         });
      }
      else {
         db.appendToCollection("gang", document, (_appendErr) => {

            if (_appendErr) {
               return _callback(_appendErr);
            }

            db.consoleCreatedEmptyDb = false;
            this.updateGangDbHash(( _hashErr) => _callback(_hashErr, document));
         });
      }
   });
};

GangConsoleCmd.prototype.findGangServiceConfig = function(_serviceType, _serviceName, _callback) {
   var db = this.gang.getDb();

   if (!db || (typeof db.readCollection !== "function")) {
      return _callback("Gang database is not available");
   }

   db.readCollection("gangServices", (_err, _services) => {

      if (_err) {
         return _callback(_err);
      }

      for (var i = 0; _services && (i < _services.length); ++i) {

         if (((_serviceName && (_services[i].name === _serviceName)) ||
              (_serviceType && (_services[i].type === _serviceType)))) {
            return _callback(null, _services[i]);
         }
      }

      _callback(null, null);
   });
};

GangConsoleCmd.prototype.upsertGangServiceConfig = function(_serviceConfig, _callback) {
   var db = this.gang.getDb();

   this.findGangServiceConfig(_serviceConfig.type, _serviceConfig.name, (_err, _existing) => {

      if (_err) {
         return _callback(_err);
      }

      if (_existing) {
         _serviceConfig.name = _existing.name;
         _serviceConfig._collection = _existing._collection;
         _serviceConfig._id = _existing._id;

         db.update(_serviceConfig, (_updateErr) => {

            if (_updateErr) {
               return _callback(_updateErr);
            }

            db.consoleCreatedEmptyDb = false;
            this.updateGangDbHash(( _hashErr) => _callback(_hashErr, _serviceConfig));
         });
      }
      else {
         db.appendToCollection("gangServices", _serviceConfig, (_appendErr) => {

            if (_appendErr) {
               return _callback(_appendErr);
            }

            db.consoleCreatedEmptyDb = false;
            this.updateGangDbHash(( _hashErr) => _callback(_hashErr, _serviceConfig));
         });
      }
   });
};

GangConsoleCmd.prototype.parseOrganisationArgs = function(_arguments) {
   var subCommand = (_arguments && (_arguments.length > 0)) ? _arguments[0] : "show";

   if (subCommand === "show") {

      if (_arguments && (_arguments.length > 1)) {
         return { error: "Too many arguments. Usage: organisation show" };
      }

      return { command: "show" };
   }

   if (subCommand !== "set") {
      return { error: "Unsupported organisation command \"" + subCommand + "\". Usage: organisation show|set --name <name>" };
   }

   var definitions = [
      { name: 'name', alias: 'n', defaultOption: true, type: String }
   ];
   var options;

   try {
      options = commandLineArgs(definitions, { argv: _arguments.slice(1), stopAtFirstUnknown: true });
   }
   catch (_err) {
      return { error: _err.message ? _err.message : "Unable to parse organisation command" };
   }

   if (options._unknown && (options._unknown.length > 0)) {
      return { error: "Too many arguments. Usage: organisation set --name <name>" };
   }

   if (!options.name || (String(options.name).trim().length === 0)) {
      return { error: "Organisation name not provided. Usage: organisation set --name <name>" };
   }

   return { command: "set", name: String(options.name).trim() };
};

GangConsoleCmd.prototype.parsePusherArgs = function(_arguments) {
   var subCommand = (_arguments && (_arguments.length > 0)) ? _arguments[0] : "show";

   if (subCommand === "show") {

      if (_arguments && (_arguments.length > 1)) {
         return { error: "Too many arguments. Usage: pusher show" };
      }

      return { command: "show" };
   }

   if (subCommand !== "set") {
      return { error: "Unsupported pusher command \"" + subCommand + "\". Usage: pusher show|set --id <id> --key <key> --secret <secret> --cluster <cluster>" };
   }

   var definitions = [
      { name: 'id', type: String },
      { name: 'key', type: String },
      { name: 'secret', type: String },
      { name: 'cluster', type: String }
   ];
   var options;

   try {
      options = commandLineArgs(definitions, { argv: _arguments.slice(1), stopAtFirstUnknown: true });
   }
   catch (_err) {
      return { error: _err.message ? _err.message : "Unable to parse pusher command" };
   }

   if (options._unknown && (options._unknown.length > 0)) {
      return { error: "Too many arguments. Usage: pusher set --id <id> --key <key> --secret <secret> --cluster <cluster>" };
   }

   if (!options.id || !options.key || !options.secret || !options.cluster ||
       (String(options.id).trim().length === 0) ||
       (String(options.key).trim().length === 0) ||
       (String(options.secret).trim().length === 0) ||
       (String(options.cluster).trim().length === 0)) {
      return { error: "Missing Pusher credential. Usage: pusher set --id <id> --key <key> --secret <secret> --cluster <cluster>" };
   }

   return {
      command: "set",
      appId: String(options.id).trim(),
      appKey: String(options.key).trim(),
      appSecret: String(options.secret).trim(),
      appCluster: String(options.cluster).trim()
   };
};

GangConsoleCmd.prototype.maskSecret = function(_secret) {

   if (!_secret) {
      return null;
   }

   return "configured";
};

GangConsoleCmd.prototype.remoteGangCommandAvailable = function() {
   return !!(this.console && !this.console.offline &&
             ((this.console.getCurrentCasa && this.console.getCurrentCasa()) || this.console.defaultCasa));
};

GangConsoleCmd.prototype.executeRemoteOrLocalGangCommand = function(_method, _params, _localMethod, _callback) {

   if (this.remoteGangCommandAvailable()) {
      return this.executeParsedCommand(_method, _params, _callback);
   }

   return Object.getPrototypeOf(this)[_localMethod].call(this, _params, _callback);
};

GangConsoleCmd.prototype.organisationLocal = function(_params, _callback) {
   var params = (_params && (_params.length > 0)) ? _params[0] : { command: "show" };

   if (!params || (params.command === "show")) {
      return _callback(null, {
         gangName: this.gang.name,
         organisation: this.gang.getOrganisation ? (this.gang.getOrganisation() || null) : null,
         source: "local"
      });
   }

   if (params.command !== "set") {
      return _callback("Unsupported organisation command");
   }

   this.upsertGangDocument({ organisation: params.name }, (_err) => {

      if (_err) {
         return _callback(_err);
      }

      this.gang.organisation = params.name;
      this.gang.config.organisation = params.name;

      _callback(null, {
         gangName: this.gang.name,
         organisation: params.name,
         source: "local"
      });
   });
};

GangConsoleCmd.prototype.pusherLocal = function(_params, _callback) {
   var params = (_params && (_params.length > 0)) ? _params[0] : { command: "show" };

   if (!params || (params.command === "show")) {
      return this.findGangServiceConfig("pusherservice", "pusher-service", (_err, _serviceConfig) => {

         if (_err) {
            return _callback(_err);
         }

         _callback(null, {
            configured: !!_serviceConfig,
            name: _serviceConfig ? _serviceConfig.name : null,
            appId: _serviceConfig ? _serviceConfig.appId : null,
            key: _serviceConfig ? _serviceConfig.appKey : null,
            secret: _serviceConfig ? this.maskSecret(_serviceConfig.appSecret) : null,
            cluster: _serviceConfig ? _serviceConfig.appCluster : null,
            source: "local"
         });
      });
   }

   if (params.command !== "set") {
      return _callback("Unsupported pusher command");
   }

   var serviceConfig = {
      name: "pusher-service",
      type: "pusherservice",
      appId: params.appId,
      appKey: params.appKey,
      appSecret: params.appSecret,
      appCluster: params.appCluster
   };

   this.upsertGangServiceConfig(serviceConfig, (_err) => {

      if (_err) {
         return _callback(_err);
      }

      _callback(null, {
         configured: true,
         name: serviceConfig.name,
         appId: serviceConfig.appId,
         key: serviceConfig.appKey,
         secret: this.maskSecret(serviceConfig.appSecret),
         cluster: serviceConfig.appCluster,
         source: "local",
         restartRequired: true
      });
   });
};

GangConsoleCmd.prototype.reboot = function(_arguments, _callback)  {

   if (_arguments && (_arguments.length > 0) && (_arguments === "--hard")) {
      this.executeParsedCommandOnAllCasas("reboot", [ true ], _callback);
   }
   else {
      this.executeParsedCommandOnAllCasas("reboot", _arguments, _callback);
   }
};

GangConsoleCmd.prototype.restart = function(_arguments, _callback)  {

   if (_arguments && (_arguments.length > 0) && (_arguments === "--hard")) {
      this.executeParsedCommandOnAllCasas("restart", [ true ], _callback);
   }
   else {
      this.executeParsedCommandOnAllCasas("restart", _arguments, _callback);
   }
};

GangConsoleCmd.prototype.pushDbs = function(_arguments, _callback) {
   this.checkArguments(0, _arguments);

   this.dbPushPayload(this.gang.getDb(), (_err, _gangPayload) => {

      if (_err) {
         return _callback(_err);
      }

      this.pushGangAndCasaDbPayloadsToAllCasas(_gangPayload, _callback);
   });
};

GangConsoleCmd.prototype.pushDb = function(_arguments, _callback) {
   this.checkArguments(0, _arguments);

   this.dbPushPayload(this.gang.getDb(), (_err, _payload) => {

      if (_err) {
         return _callback(_err);
      }

      this.executeParsedCommandOnAllCasas("replaceDb", [ _payload ], _callback);
   });
};

GangConsoleCmd.prototype.pushGangAndCasaDbPayloadsToAllCasas = function(_gangPayload, _callback) {
   var casaNames = Object.keys(this.console.remoteCasas).sort( (_a, _b) => _a.localeCompare(_b));
   var firstError = null;
   var lastResult = null;
   var pushedCount = 0;

   var pushNext = (_index) => {

      if (_index >= casaNames.length) {

         if (pushedCount === 0) {
            return _callback(firstError ? firstError : "No Casa connected!");
         }

         return _callback(firstError, lastResult);
      }

      var casa = this.console.remoteCasas[casaNames[_index]];

      if (!casa || !casa.connected) {
         return pushNext(_index + 1);
      }

      this.dbPushPayload(casa.getDb(), (_payloadErr, _casaPayload) => {

         if (_payloadErr) {

            if (!firstError) {
               firstError = _payloadErr;
            }

            return pushNext(_index + 1);
         }

         this.console.sendCommandToCasa(casa, [ this.uName, "replaceDbs", [ [ _gangPayload, _casaPayload ] ] ], "executeParsedCommand", (_err, _result) => {
            pushedCount = pushedCount + 1;

            if (_err && !firstError) {
               firstError = _err;
            }
            else if (!_err) {
               lastResult = _result;
            }

            pushNext(_index + 1);
         });
      });
   };

   pushNext(0);
};

GangConsoleCmd.prototype.pullDb = function(_arguments, _callback) {
   this.checkArguments(0, _arguments);

   if (this.console.dbCompare() !== 0) {
      this.dbService.getAndWritePeerDb(this.gang.getDb().name, this.console.getCurrentCasa().getHost(), this.console.getCurrentCasa().getListeningPort(), this.gang.configPath(), _callback);
   }
   else {
      return _callback(null, true);
   }
};

GangConsoleCmd.prototype.syncDb = function(_arguments, _callback) {
   this.checkArguments(0, _arguments);

   var remoteCasa = this.console.getCurrentCasa() ? this.console.getCurrentCasa() : this.console.defaultCasa;
   var remoteDbInfo = remoteCasa ? remoteCasa.gangRemoteDbInfo : null;
   var localDb = this.gang.getDb();
   var dbName = remoteDbInfo && remoteDbInfo.dbName ? remoteDbInfo.dbName : (localDb ? localDb.name : this.gang.name + "-db");

   this.syncDbFromRemoteCasa({
      remoteCasa: remoteCasa,
      remoteDbInfo: remoteDbInfo,
      localDb: localDb,
      dbName: dbName,
      afterWrite: (_db) => {
         this.gang.gangDb = _db;
         this.gang.dbs[dbName] = _db;
      }
   }, _callback);
};

GangConsoleCmd.prototype.exportDb = function(_arguments, _callback) {

   this.checkArguments(0, _arguments);

   this.pullDb([], (_err, _result) => {

      if (_err) {
         return _callback(_err);
      }

      var db = this.gang.getDb();

      db.readAll( (_err, _result) => {

         if (_err) {
            return _callback(_err);
         }

         Db = require('../db');
         var output = Db.export(_result);
         var fileName = this.gang.configPath() + "/configs/" + this.gang.getDb().name + ".json";
         var fs = require('fs');
         var content = JSON.stringify(output, null, 3);

         fs.writeFile(fileName, content, (_err) => {
            return _callback(_err, true);
         });
      });
   });
};

GangConsoleCmd.prototype.topology = function(_arguments, _callback) {
   this.checkArguments(0, _arguments);
   this.executeParsedCommand("topology", [], _callback);
};

GangConsoleCmd.prototype.organisation = function(_arguments, _callback) {
   var parsed = this.parseOrganisationArgs(_arguments ? _arguments : []);

   if (parsed.error) {
      return _callback(parsed.error);
   }

   this.executeRemoteOrLocalGangCommand("organisation", [ parsed ], "organisationLocal", _callback);
};

GangConsoleCmd.prototype.pusher = function(_arguments, _callback) {
   var parsed = this.parsePusherArgs(_arguments ? _arguments : []);

   if (parsed.error) {
      return _callback(parsed.error);
   }

   this.executeRemoteOrLocalGangCommand("pusher", [ parsed ], "pusherLocal", _callback);
};

GangConsoleCmd.prototype.resolveSource = function(_arguments, _callback) {
   this.checkArguments(1, _arguments);
   var parsed = parseSourceCommandArgs(_arguments);

   if (parsed.error) {
      return _callback(parsed.error);
   }

   executeOnSpecificCasa(this, "resolveSource", parsed, _callback);
};

GangConsoleCmd.prototype.sourceTreeState = function(_arguments, _callback) {
   this.checkArguments(1, _arguments);
   var parsed = parseSourceCommandArgs(_arguments);

   if (parsed.error) {
      return _callback(parsed.error);
   }

   executeOnSpecificCasa(this, "sourceTreeState", parsed, _callback);
};

GangConsoleCmd.prototype.resolveSources = function(_arguments, _callback) {
   this.checkArguments(1, _arguments);
   this.executeParsedCommand("resolveSources", _arguments, _callback);
};

GangConsoleCmd.prototype.explainSource = function(_arguments, _callback) {
   this.checkArguments(1, _arguments);
   var parsed = parseSourceCommandArgs(_arguments);

   if (parsed.error) {
      return _callback(parsed.error);
   }

   executeOnSpecificCasa(this, "explainSource", parsed, _callback);
};

GangConsoleCmd.prototype.sourceUsage = function(_arguments, _callback) {
   this.checkArguments(1, _arguments);
   var parsed = parseSourceUsageArgs(_arguments);

   if (parsed.error) {
      return _callback(parsed.error);
   }

   executeOnSpecificCasa(this, "sourceUsage", parsed, _callback);
};

GangConsoleCmd.prototype.listSources = function(_arguments, _callback) {
   this.checkArguments(0, _arguments);
   this.executeParsedCommand("listSources", _arguments ? _arguments : [], _callback);
};

GangConsoleCmd.prototype.sourceTrees = function(_arguments, _callback) {
   this.checkArguments(0, _arguments);
   var parsed = parseSourceTreesArgs(_arguments ? _arguments : []);

   if (parsed.error) {
      return _callback(parsed.error);
   }

   executeOnSpecificCasaWithParams(this, "sourceTrees", parsed.casaName, [], _callback);
};

GangConsoleCmd.prototype.previewConfig = function(_arguments, _callback) {
   this.checkArguments(1, _arguments);
   var parsed = parsePreviewConfigArgs(_arguments);

   if (parsed.error) {
      return _callback(parsed.error);
   }

   executeOnSpecificCasaWithParams(this, "previewConfig", parsed.casaName, parsed.params, _callback);
};

GangConsoleCmd.prototype.importDb = function(_arguments, _callback) {
   this.checkArguments(0, _arguments);

   var cjson = require('cjson');
   var configFilename = this.gang.configPath() + "/configs/" + this.gang.getDb().name + ".json";
   var inputConfig = cjson.load(configFilename);

   if (inputConfig.gang.name !== this.gang.name) {
      return _callback("Config file corrupt.");
   }
      
   var Db = require('../db');
   var db = new Db(this.gang.name, undefined, true);
      

   db.on('connected', () => {
      var collections = {};
      collections.gang = { "name": "", "type": "", "displayName": "", "parentCasa": {} };

      for (var param in collections.gang) {

         if (inputConfig.gang.hasOwnProperty(param)) {
            collections.gang[param] = inputConfig.gang[param];
         }
      }

      collections.gangUsers = inputConfig.hasOwnProperty("gangUsers") ? inputConfig.gangUsers : inputConfig.gang.hasOwnProperty("users") ? inputConfig.gang.users : [];
      collections.gangScenes = inputConfig.hasOwnProperty("gangScenes") ? inputConfig.gangScenes : inputConfig.gang.hasOwnProperty("scenes") ? inputConfig.gang.scenes : [];
      collections.gangThings = inputConfig.hasOwnProperty("gangThings") ? inputConfig.gangThings : inputConfig.gang.hasOwnProperty("things") ? inputConfig.gang.things : [];

      for (var collection in collections) {

         if (collections.hasOwnProperty(collection)) {
            db.appendToCollection(collection, collections[collection]);
         }
      }

      db.readCollection("gangThings", (_err, _res) => {
         db.close();

         if (_err) {
            return _callback("Failed to create DB. Error="+_err);
         }

         db.updateHashInternal((_hashErr) => {

            if (_hashErr) {
               return _callback(_hashErr);
            }

            this.dbPushPayload(db, (_payloadErr, _payload) => {

               if (_payloadErr) {
                  return _callback(_payloadErr);
               }

               this.executeParsedCommandOnAllCasas("replaceDb", [ _payload ], _callback);
            });
         });
      });
   });

   db.on('error', (_data) => {
      _callback("Unable to open database!");
   });

   db.connect();
};

module.exports = exports = GangConsoleCmd;
 
