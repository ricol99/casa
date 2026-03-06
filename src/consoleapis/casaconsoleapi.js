var util = require('util');
var ConsoleApi = require('../consoleapi');
var ConfigPreviewEngine = require('./configpreviewengine');

function CasaConsoleApi(_config, _owner) {
   ConsoleApi.call(this, _config, _owner);
   this.dbService =  this.gang.casa.findService("dbservice");
}

util.inherits(CasaConsoleApi, ConsoleApi);

function normaliseSourceInventoryMode(_mode) {
   var mode = (typeof _mode === "string") ? _mode.trim().toLowerCase() : "both";

   if ((mode !== "exports") && (mode !== "local") && (mode !== "both")) {
      mode = "both";
   }

   return mode;
}

function normaliseSourceInventoryPrefix(_prefix) {

   if (typeof _prefix !== "string") {
      return null;
   }

   var prefix = _prefix.trim();

   if (prefix.length === 0) {
      return null;
   }

   if (prefix[0] !== ":") {
      prefix = ":" + prefix;
   }

   return prefix;
}

function normaliseSourceUName(_uName) {

   if (typeof _uName !== "string") {
      return null;
   }

   var uName = _uName.trim();

   if (uName.length === 0) {
      return null;
   }

   if (uName[0] !== ":") {
      uName = ":" + uName;
   }

   return uName;
}

function findSourceInMap(_sourceMap, _sourceUName) {

   if (!_sourceMap || !_sourceUName) {
      return null;
   }

   if (_sourceMap.hasOwnProperty(_sourceUName) && _sourceMap[_sourceUName]) {
      return _sourceMap[_sourceUName];
   }

   for (var sourceName in _sourceMap) {

      if (_sourceMap.hasOwnProperty(sourceName) && _sourceMap[sourceName] &&
          (typeof _sourceMap[sourceName].findNamedObject === "function")) {
         var nestedSource = _sourceMap[sourceName].findNamedObject(_sourceUName);

         if (nestedSource) {
            return nestedSource;
         }
      }
   }

   return null;
}

function sourceInventoryType(_source) {

   if (!_source) {
      return "unknown";
   }

   if (_source.type) {
      return _source.type;
   }

   if (_source.config && _source.config.type) {
      return _source.config.type;
   }

   if (typeof _source.superType === "function") {
      return _source.superType();
   }

   return "unknown";
}

function sourceInventoryScope(_source, _gangName, _localCasaName) {
   var ownerDb = _source && _source.config ? _source.config._db : null;

   if (ownerDb === _gangName) {
      return "gang";
   }
   else if (ownerDb === _localCasaName) {
      return "casa";
   }
   else if (ownerDb) {
      return "external-casa";
   }

   return "runtime";
}

function classifySourceInventoryShare(_casa, _source) {
   var localFlag = !!(_source && _source.config && _source.config.local);
   var fromGangDb = !!(_source && _source.config && _casa && _casa.gang && _casa.gang.name && (_source.config._db === _casa.gang.name));
   var shared = !!(_casa && (typeof _casa.shouldShareSourceInSimpleConfig === "function") && _casa.shouldShareSourceInSimpleConfig(_source));

   if (shared) {
      return { shared: true, category: "exports", reason: "shareable" };
   }

   if (localFlag) {
      return { shared: false, category: "local", reason: "config.local=true" };
   }

   if (fromGangDb) {
      return { shared: false, category: "local", reason: "owned-by-gang-db" };
   }

   return { shared: false, category: "local", reason: "excluded-by-share-rule" };
}

// Called when current state required
CasaConsoleApi.prototype.export = function(_exportObj) {
   ConsoleApi.prototype.export.call(this, _exportObj);
};

// Called to restore current state
CasaConsoleApi.prototype.import = function(_importObj) {
   ConsoleApi.prototype.import.call(this, _importObj);
};

CasaConsoleApi.prototype.coldStart = function() {
   ConsoleApi.prototype.coldStart.call(this);
};

CasaConsoleApi.prototype.hotStart = function() {
   ConsoleApi.prototype.hotStart.call(this);
};

CasaConsoleApi.prototype.exportData = function(_session, _params, _callback) {
   var exportData = {};

   if (this.myObj().export(exportData)) {
      console.info("AAAAAA export=", exportData);
      _callback(null, exportData);
   }
   else {
      _callback("No objects to export!");
   }
};

CasaConsoleApi.prototype.exportDb = function(_session, _params, _callback) {
   var exportData = {};

   if (this.gang.exportDb(exportData)) {
      _callback(null, exportData);
   }
   else {
      _callback("No objects to export!");
   }
};

CasaConsoleApi.prototype.cat = function(_session, _params, _callback) {
   var output = [];

   for (var source in this.myObj().sources) {

      if (this.myObj().sources.hasOwnProperty(source)) {
         output.push(this.myObj().sources[source].name);
      }
   }

   _callback(null, output);
};

CasaConsoleApi.prototype.sources = function(_session, _params, _callback) {
   var sources = [];

   for (var source in this.myObj().sources) {
      sources.push(this.myObj().sources[source].name);
   }

   _callback(null, sources);
};

CasaConsoleApi.prototype.services = function(_session, _params, _callback) {
   var services = [];

   for (var service in this.myObj().services) {
      services.push(this.myObj().services[service].name);
   }

   _callback(null, services);
};

CasaConsoleApi.prototype.sourceInventoryInternal = function(_options) {
   var options = ((typeof _options === "object") && !(_options instanceof Array) && _options) ? _options : {};
   var mode = normaliseSourceInventoryMode(options.mode);
   var prefix = normaliseSourceInventoryPrefix(options.prefix);
   var sources = [];
   var totalSources = 0;
   var matchedSources = 0;
   var matchedExports = 0;
   var matchedLocal = 0;
   var casa = this.gang.casa;

   for (var sourceUName in casa.sources) {

      if (!casa.sources.hasOwnProperty(sourceUName) || !casa.sources[sourceUName]) {
         continue;
      }

      ++totalSources;

      var source = casa.sources[sourceUName];

      if (prefix && !source.uName.startsWith(prefix)) {
         continue;
      }

      ++matchedSources;

      var shareClass = classifySourceInventoryShare(casa, source);

      if (shareClass.shared) {
         ++matchedExports;
      }
      else {
         ++matchedLocal;
      }

      if ((mode !== "both") && (shareClass.category !== mode)) {
         continue;
      }

      sources.push({
         sourceUName: source.uName,
         name: source.name,
         type: sourceInventoryType(source),
         superType: (typeof source.superType === "function") ? source.superType() : null,
         priority: (source.priority !== undefined) ? source.priority : 0,
         db: (source.config && source.config._db) ? source.config._db : null,
         scope: sourceInventoryScope(source, this.gang.name, casa.name),
         shared: shareClass.shared,
         category: shareClass.category,
         reason: shareClass.reason
      });
   }

   sources.sort( (_a, _b) => (_a.sourceUName > _b.sourceUName) ? 1 : ((_a.sourceUName < _b.sourceUName) ? -1 : 0));

   return {
      casaName: casa.name,
      mode: mode,
      prefix: prefix,
      count: sources.length,
      summary: {
         totalSources: totalSources,
         matchedSources: matchedSources,
         matchedExports: matchedExports,
         matchedLocal: matchedLocal
      },
      sources: sources
   };
};

CasaConsoleApi.prototype.sourceInventory = function(_session, _params, _callback) {
   var options = (_params && (_params.length > 0)) ? _params[0] : {};
   _callback(null, this.sourceInventoryInternal(options));
};

CasaConsoleApi.prototype.getSourceObjectForUName = function(_sourceUName) {
   var sourceObj = this.gang.findNamedObject(_sourceUName);

   if (sourceObj) {
      return sourceObj;
   }

   sourceObj = findSourceInMap(this.gang.casa.sources, _sourceUName);

   if (!sourceObj) {
      sourceObj = findSourceInMap(this.gang.casa.bowingSources, _sourceUName);
   }

   if (sourceObj) {
      return sourceObj;
   }

   for (var peerName in this.gang.peercasas) {

      if (this.gang.peercasas.hasOwnProperty(peerName)) {
         var peerCasa = this.gang.peercasas[peerName];
         sourceObj = findSourceInMap(peerCasa.sources, _sourceUName);

         if (!sourceObj) {
            sourceObj = findSourceInMap(peerCasa.bowingSources, _sourceUName);
         }

         if (sourceObj) {
            return sourceObj;
         }
      }
   }

   return null;
};

CasaConsoleApi.prototype.getSourceConsoleApiForUName = function(_sourceUName) {
   var sourceObj = this.getSourceObjectForUName(_sourceUName);

   if (!sourceObj || !this.consoleApiService || (typeof this.consoleApiService.findOrCreateConsoleApiObject !== "function")) {
      return null;
   }

   return this.consoleApiService.findOrCreateConsoleApiObject(sourceObj);
};

CasaConsoleApi.prototype.sourceUsageInternal = function(_sourceUName, _options) {
   var sourceApi = this.getSourceConsoleApiForUName(_sourceUName);

   if (sourceApi && (typeof sourceApi.usageForUName === "function")) {
      return sourceApi.usageForUName(_sourceUName, _options);
   }

   return {
      sourceUName: _sourceUName,
      exists: false,
      reason: "Source not found in active or bowing maps",
      instances: []
   };
};

CasaConsoleApi.prototype.resolveSourceInternal = function(_sourceUName) {
   var sourceApi = this.getSourceConsoleApiForUName(_sourceUName);

   if (sourceApi && (typeof sourceApi.resolveForUName === "function")) {
      return sourceApi.resolveForUName(_sourceUName);
   }

   return {
      sourceUName: _sourceUName,
      exists: false,
      activeOwnerCasa: null,
      activeProviderType: null,
      instances: []
   };
};

CasaConsoleApi.prototype.resolveSource = function(_session, _params, _callback) {
   this.checkParams(1, _params);

   var sourceUName = normaliseSourceUName(_params[0]);

   if (!sourceUName) {
      return _callback("Invalid source uName");
   }

   _callback(null, this.resolveSourceInternal(sourceUName));
};

CasaConsoleApi.prototype.explainSourceInternal = function(_sourceUName) {
   var sourceApi = this.getSourceConsoleApiForUName(_sourceUName);

   if (sourceApi && (typeof sourceApi.explainForUName === "function")) {
      return sourceApi.explainForUName(_sourceUName);
   }

   return {
      sourceUName: _sourceUName,
      exists: false,
      reason: "Source not found in active or bowing maps"
   };
};

CasaConsoleApi.prototype.explainSource = function(_session, _params, _callback) {
   this.checkParams(1, _params);

   var sourceUName = normaliseSourceUName(_params[0]);

   if (!sourceUName) {
      return _callback("Invalid source uName");
   }

   _callback(null, this.explainSourceInternal(sourceUName));
};

CasaConsoleApi.prototype.sourceUsage = function(_session, _params, _callback) {
   this.checkParams(1, _params);

   var sourceUName = normaliseSourceUName(_params[0]);
   var options = (_params.length > 1) ? _params[1] : {};

   if (!sourceUName) {
      return _callback("Invalid source uName");
   }

   _callback(null, this.sourceUsageInternal(sourceUName, options));
};

CasaConsoleApi.prototype.previewConfigInternal = function(_options) {
   return ConfigPreviewEngine.previewConfig(_options ? _options : {}, {
      mode: "casa",
      gang: this.gang,
      gangName: this.gang.name,
      defaultCasaName: this.gang.casa.name,
      targetCasaName: this.gang.casa.name,
      resolveSourceFn: this.resolveSourceInternal.bind(this),
      sourceUsageFn: this.sourceUsageInternal.bind(this)
   });
};

CasaConsoleApi.prototype.previewConfig = function(_session, _params, _callback) {
   var options = (_params && (_params.length > 0)) ? _params[0] : {};
   _callback(null, this.previewConfigInternal(options));
};

CasaConsoleApi.prototype.createService = function(_session, _params, _callback) {
   this.checkParams(1, _params);
   var newServiceConfig = _params[0];
   var persist = (_params.length > 1) ? _params[1] : false;

   if (this.gang.findService(newServiceConfig.name)) {
      return _callback("Service already exists!");
   }

   if (persist) {
      this.db = this.gang.getDb(this.gang.casa.name);

      this.db.find(newServiceConfig.name, (_err, _result) => {

         if (_err || (_result === null)) {
            var serviceObj = this.gang.createService(util.copy(newServiceConfig, true));

            this.db.appendToCollection("services", newServiceConfig, (_err2, _result2) => {

               if (_err2) {
                  return _callback("Not able to perist the change");
               }

               this.gang.casa.refreshSourceListeners();
               serviceObj.coldStart();
               return _callback(null, true);
            });
         }
         else {
            return _callback("Service already exists!");
         }
      });
   }
   else {
      var serviceObj = this.gang.createService(newServiceConfig);
      this.gang.casa.refreshSourceListeners();
      serviceObj.coldStart();
      _callback(null, true);
   }
};

CasaConsoleApi.prototype.createThing = function(_session, _params, _callback) {
   this.checkParams(1, _params);
   var newThingConfig = _params[0];
   var persist = (_params.length > 1) ? _params[1] : false;
   var thingUName = newThingConfig.name && newThingConfig.name.startsWith(":") ? newThingConfig.name : ":" + newThingConfig.name;

   if (this.gang.findNamedObject(thingUName)) {
      return _callback("Thing already exists!");
   }

   if (persist) {
      this.db = this.gang.getDb(this.gang.casa.name);

      this.db.find(newThingConfig.name, (_err, _result) => {

         if (_err || (_result === null)) {
            var thingObj = this.gang.createThing(util.copy(newThingConfig, true));

            this.db.appendToCollection("things", newThingConfig, (_err2, _result2) => {

               if (_err2) {
                  return _callback("Not able to perist the change");
               }

               this.gang.casa.refreshSourceListeners();
               thingObj.coldStart();
               return _callback(null, true);
            });
         }
         else {
            return _callback("Thing already exists!");
         }
      });
   }
   else {
      var thingObj = this.gang.createThing(newThingConfig);
      this.gang.casa.refreshSourceListeners();
      thingObj.coldStart();
      _callback(null, true);
   }
};

CasaConsoleApi.prototype.reboot = function(_session, _params, _callback) {

   if ((_params && (_params.length > 0) && _params[0]) || (!this.gang.ignoreRestart)) {
      require('reboot').reboot();
      return _callback("Unable to reboot - insufficient permissions!");
   }
   else {
      return _callback(this.gang.casa.uName + ": Ignoring reboot!");
   }
};

CasaConsoleApi.prototype.restart = function(_session, _params, _callback) {

   if ((_params && (_params.length > 0) && _params[0]) || (!this.gang.ignoreRestart)) {
      process.exit(3);
   }
   else {
      return _callback(this.gang.casa.uName + ": Ignoring restart!");
   }
};

CasaConsoleApi.prototype.updateDb = function(_session, _params, _callback) {
   this.checkParams(2, _params);

   var dbName = (_params.length > 2) ? _params[2] : this.gang.casa.name;
   var localHash = this.dbService.getDbHash(dbName);

   this.dbService.getPeerDbHash(dbName, localHash, _params[0], _params[1], (_err, _result) => {

      if (_err) {
         return _callback(_err);
      }
      else if (localHash.hash !== _result.hash) {
         this.dbService.getAndWritePeerDb(dbName, _params[0], _params[1], this.gang.configPath(), _callback);
      }
      else {
         _callback(null, true);
      }
   });
};

CasaConsoleApi.prototype.updateDbs = function(_session, _params, _callback) {
   this.checkParams(2, _params);

   this.updateDb(_params, (_err, _result) => {

      if (_err)  {
         _callback(_err);
      }
      else {
         _params.push(this.gang.name);
         this.updateDb(_params, _callback);
      }
   });
};

CasaConsoleApi.prototype.exportDb = function(_session, _params, _callback) {
   this.gang.casa.getDb().readAll(_callback);
};

module.exports = exports = CasaConsoleApi;
 
