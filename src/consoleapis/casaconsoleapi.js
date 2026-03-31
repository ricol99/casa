var util = require('util');
var ConsoleApi = require('../consoleapi');
var ConfigPreviewEngine = require('./configpreviewengine');

function CasaConsoleApi(_config, _owner) {
   ConsoleApi.call(this, _config, _owner);
   this.dbService =  this.gang.casa.findService("dbservice");
}

util.inherits(CasaConsoleApi, ConsoleApi);

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

function emitPreviewProgress(_api, _session, _scope, _targetCasa, _event) {

   if (!_event || !_api || !_session || !_session.name || !_api.consoleApiService ||
       (typeof _api.consoleApiService.writeOutput !== "function")) {
      return;
   }

   _api.consoleApiService.writeOutput(_session.name, {
      type: "previewConfigProgress",
      scope: _scope,
      targetCasa: _targetCasa,
      progress: _event
   });
}

function exportNamedObjectTree(_root, _filter, _process) {
   if (!_root) {
      return null;
   }

   var exportObj = {};
   _root.exportTree(exportObj, _filter ? _filter : null, _process ? _process : null);
   return exportObj;
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

   if (this.myObj().exportTree(exportData)) {
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

CasaConsoleApi.prototype.sourceTreesInternal = function() {
   var casa = this.gang.casa;
   var sourceFilter = function(_child, _owner) {

      if (!_child) {
         return false;
      }

      if (_child === casa.gang) {
         return true;
      }

      if (_child.type === "namedobject") {
         return true;
      }

      if (_child.superType && ((_child.superType() === "thing") || (_child.superType() === "property") || (_child.superType() === "event"))) {
         return true;
      }

      return (_child.type === "peersource");
   };
   var annotateSourceNode = function(_context, _source, _owner) {

      if (!_source || !_context) {
         return false;
      }

      if ((_source.type === "peersource") ||
          (_source.superType && (_source.superType() === "thing"))) {
         _context.ownerCasa = (_source.casa && _source.casa.name) ? _source.casa.name : casa.name;
         _context.providerType = (_source.type === "peersource") ? "peercasa" : "casa";
         _context.local = !!_source.local;
      }

      return false;
   };

   var peerTrees = [];

   for (var peerCasaName in this.gang.peercasas) {

      if (this.gang.peercasas.hasOwnProperty(peerCasaName) && this.gang.peercasas[peerCasaName]) {
         var peerCasa = this.gang.peercasas[peerCasaName];
         var peerTree = exportNamedObjectTree(peerCasa.peerRoot, sourceFilter, annotateSourceNode);
         peerTrees.push({
            casaName: peerCasa.name,
            connected: !!peerCasa.connected,
            tree: peerTree
         });
      }
   }

   peerTrees.sort( (_a, _b) => (_a.casaName > _b.casaName) ? 1 : ((_a.casaName < _b.casaName) ? -1 : 0));

   return {
      casaName: casa.name,
      activeTree: exportNamedObjectTree(this.gang, sourceFilter, annotateSourceNode),
      localBowedTree: exportNamedObjectTree(casa.bowingRoot, sourceFilter, annotateSourceNode),
      peerTrees: peerTrees
   };
};

CasaConsoleApi.prototype.sourceTrees = function(_session, _params, _callback) {
   _callback(null, this.sourceTreesInternal());
};

CasaConsoleApi.prototype.configuredSourceTreeInternal = function() {
   var casa = this.gang.casa;
   var configuredFilter = function(_child, _owner) {

      if (!_child) {
         return false;
      }

      if (_child === casa.gang) {
         return true;
      }

      if (_child.type === "namedobject") {
         return true;
      }

      if (_child.fromPeer || _child.transient || (_child.type === "peersource")) {
         return false;
      }

      return !!(_child.superType &&
                ((_child.superType() === "thing") ||
                 (_child.superType() === "property") ||
                 (_child.superType() === "event")));
   };

   return exportNamedObjectTree(this.gang, configuredFilter, null);
};

CasaConsoleApi.prototype.configuredSourceTree = function(_session, _params, _callback) {
   _callback(null, this.configuredSourceTreeInternal());
};

CasaConsoleApi.prototype.getSourceObjectForUName = function(_sourceUName) {
   var sourceObj = this.gang.findNamedObject(_sourceUName);

   if (sourceObj) {
      return sourceObj;
   }

   sourceObj = this.gang.casa.bowingRoot ? this.gang.casa.bowingRoot.findNamedObject(_sourceUName) : null;

   if (sourceObj) {
      return sourceObj;
   }

   for (var peerName in this.gang.peercasas) {

      if (this.gang.peercasas.hasOwnProperty(peerName)) {
         var peerCasa = this.gang.peercasas[peerName];
         sourceObj = peerCasa.peerRoot ? peerCasa.peerRoot.findNamedObject(_sourceUName) : null;

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
      reason: "Source not found in active tree or bowed trees",
      instances: []
   };
};

CasaConsoleApi.prototype.resolveSourceInternal = function(_sourceUName) {
   var sourceApi = this.consoleApiService.findOrCreateConsoleApiObject(_sourceUName);

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
   var sourceApi = this.consoleApiService.findOrCreateConsoleApiObject(_sourceUName);

   if (sourceApi && (typeof sourceApi.explainForUName === "function")) {
      return sourceApi.explainForUName(_sourceUName);
   }

   return {
      sourceUName: _sourceUName,
      exists: false,
      reason: "Source not found in active tree or bowed trees"
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

   if (!options || ((typeof options !== "object") || (options instanceof Array))) {
      options = {};
   }

   var emitProgress = !!(options.progress || options.emitProgress);

   if (!emitProgress) {
      return _callback(null, this.previewConfigInternal(options));
   }

   return ConfigPreviewEngine.previewConfigAsync(options, {
      mode: "casa",
      gang: this.gang,
      gangName: this.gang.name,
      defaultCasaName: this.gang.casa.name,
      targetCasaName: this.gang.casa.name,
      resolveSourceFn: this.resolveSourceInternal.bind(this),
      sourceUsageFn: this.sourceUsageInternal.bind(this)
   }, (_event) => {
      emitPreviewProgress(this, _session, "casa", this.gang.casa.name, _event);
   }, (_result) => {
      _callback(null, _result);
   });
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
 
