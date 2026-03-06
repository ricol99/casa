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

function parseSourceInventoryArgs(_arguments) {
   var definitions = [
      { name: 'mode', alias: 'm', type: String, defaultValue: "both" },
      { name: 'prefix', alias: 'p', type: String },
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
      return { error: "Too many arguments. Usage: sourceInventory [--mode exports|local|both] [--prefix <uNamePrefix>] [--casa <name>]" };
   }

   options.mode = (typeof options.mode === "string") ? options.mode.toLowerCase() : "both";

   if ((options.mode !== "exports") && (options.mode !== "local") && (options.mode !== "both")) {
      return { error: "Invalid mode \"" + options.mode + "\". Expected exports, local, or both." };
   }

   return {
      casaName: options.casa,
      options: {
         mode: options.mode,
         prefix: options.prefix
      }
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
   var myAddress = util.getLocalIpAddress();
   var port = this.gang.mainListeningPort();
   this.executeParsedCommandOnAllCasas("updateDbs", [ myAddress, port ], _callback);
};

GangConsoleCmd.prototype.pushDb = function(_arguments, _callback) {
   var myAddress = util.getLocalIpAddress();
   var port = this.gang.mainListeningPort();
   this.executeParsedCommandOnAllCasas("updateDb", [ myAddress, port ], _callback);
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

GangConsoleCmd.prototype.resolveSource = function(_arguments, _callback) {
   this.checkArguments(1, _arguments);
   var parsed = parseSourceCommandArgs(_arguments);

   if (parsed.error) {
      return _callback(parsed.error);
   }

   executeOnSpecificCasa(this, "resolveSource", parsed, _callback);
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

GangConsoleCmd.prototype.sourceInventory = function(_arguments, _callback) {
   this.checkArguments(0, _arguments);
   var parsed = parseSourceInventoryArgs(_arguments ? _arguments : []);

   if (parsed.error) {
      return _callback(parsed.error);
   }

   executeOnSpecificCasaWithParams(this, "sourceInventory", parsed.casaName, [ parsed.options ], _callback);
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

         var myAddress = util.getLocalIpAddress();
         var port = this.gang.mainListeningPort();

         this.executeParsedCommandOnAllCasas("updateDb", [ myAddress, port], _callback);
      });
   });

   db.on('error', (_data) => {
      _callback("Unable to open database!");
   });

   db.connect();
};

module.exports = exports = GangConsoleCmd;
 
