var ConsoleApi = require('../consoleapi');
var util = require('util');
var ConfigPreviewEngine = require('./configpreviewengine');
var MAX_RESOLVE_BATCH = 64;

function GangConsoleApi(_config, _owner) {
   ConsoleApi.call(this, _config, _owner);
   this.dbService =  this.gang.casa.findService("dbservice");
}

util.inherits(GangConsoleApi, ConsoleApi);

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

function getSourceSuperType(_source) {
   return (_source && (typeof _source.superType === "function")) ? _source.superType() : null;
}

function isTopologyCountableSource(_source) {

   if (!_source) {
      return false;
   }

   return (_source.superType() === "thing") || (_source.type === "peersource");
}

function countSourcesInTree(_root, _includeSourceFn) {
   if (!_root || (typeof _root.iterate !== "function")) {
      return 0;
   }

   var counter = 0;

   _root.iterate(null, (_source, _owner) => {
      var superType = getSourceSuperType(_source);

      if ((_source === _root) || isTopologyCountableSource(_source)) {
         return true;
      }

      return (superType !== "property") &&
             (superType !== "event") &&
             (superType !== "sourcelistener");
   }, (_context, _source, _owner) => {
      if ((_source !== _root) &&
          isTopologyCountableSource(_source) &&
          (!_includeSourceFn || _includeSourceFn(_source))) {
         counter = counter + 1;
      }

      return false;
   }, false);

   return counter;
}

function collectLocalSourceCounts(_gang) {
   var localCasa = (_gang && _gang.casa) ? _gang.casa : null;
   var privateBowed = localCasa && localCasa.bowingRoot ? countSourcesInTree(localCasa.bowingRoot, (_source) => {
      return (typeof _source.getCasa === "function") && (_source.getCasa() === localCasa) &&
             (getSourceSuperType(_source) !== "peersource") && !!_source.local;
   }) : 0;
   var bowed = localCasa && localCasa.bowingRoot ? countSourcesInTree(localCasa.bowingRoot, (_source) => {
      return (typeof _source.getCasa === "function") && (_source.getCasa() === localCasa) &&
             (getSourceSuperType(_source) !== "peersource");
   }) : 0;
   var privateActive = _gang ? countSourcesInTree(_gang, (_source) => {
      return (typeof _source.getCasa === "function") && (_source.getCasa() === localCasa) &&
             (getSourceSuperType(_source) !== "peersource") && !_source.bowing && !!_source.local;
   }) : 0;
   var active = _gang ? countSourcesInTree(_gang, (_source) => {
      return (typeof _source.getCasa === "function") && (_source.getCasa() === localCasa) &&
             (getSourceSuperType(_source) !== "peersource") && !_source.bowing;
   }) : 0;

   return {
      total: active + bowed,
      bowed: bowed,
      active: active,
      private: privateActive + privateBowed
   };
}

function collectPeerSourceCounts(_peerCasa) {
   var bowed = (_peerCasa && _peerCasa.peerRoot) ? countSourcesInTree(_peerCasa.peerRoot, (_source) => {
      return (typeof _source.getCasa === "function") && (_source.getCasa() === _peerCasa) &&
             (_source.type === "peersource") && !!_source.bowing;
   }) : 0;
   var active = (_peerCasa && _peerCasa.connected && _peerCasa.gang) ? countSourcesInTree(_peerCasa.gang, (_source) => {
      return (typeof _source.getCasa === "function") && (_source.getCasa() === _peerCasa) &&
             (_source.type === "peersource") && !_source.bowing;
   }) : 0;

   return {
      total: active + bowed,
      bowed: bowed,
      active: active
   };
}

function collectSourceUNamesFromObject(_obj, _uNameSet) {

   if (!_obj || !_uNameSet) {
      return;
   }

   if (_obj.uName && isTopologyCountableSource(_obj)) {
      _uNameSet[_obj.uName] = true;
   }

   if (!_obj.myNamedObjects) {
      return;
   }

   for (var childName in _obj.myNamedObjects) {

      if (_obj.myNamedObjects.hasOwnProperty(childName) && _obj.myNamedObjects[childName]) {
         var child = _obj.myNamedObjects[childName];
         var childSuperType = getSourceSuperType(child);

         if ((childSuperType === "property") || (childSuperType === "event") || (childSuperType === "sourcelistener")) {
            continue;
         }

         collectSourceUNamesFromObject(child, _uNameSet);
      }
   }
}

function collectKnownSourceUNames(_gang, _uNameSet) {

   if (!_gang || !_uNameSet) {
      return;
   }

   collectSourceUNamesFromObject(_gang, _uNameSet);

   if (_gang.casa && _gang.casa.bowingRoot) {
      collectSourceUNamesFromObject(_gang.casa.bowingRoot, _uNameSet);
   }

   for (var peerName in _gang.peercasas) {

      if (_gang.peercasas.hasOwnProperty(peerName) && _gang.peercasas[peerName] &&
          _gang.peercasas[peerName].peerRoot) {
         collectSourceUNamesFromObject(_gang.peercasas[peerName].peerRoot, _uNameSet);
      }
   }
}

function parseListSourcesFilters(_params) {
   var filters = {
      prefix: null,
      ownerCasa: null,
      providerType: null,
      type: null,
      scope: null,
      connected: null,
      bowed: null,
      activeOnly: false,
      includeInstances: false,
      limit: 0,
      query: null
   };

   if (!_params || (_params.length === 0)) {
      return filters;
   }

   if ((typeof _params[0] === "object") && !(_params[0] instanceof Array)) {
      var input = _params[0];

      if (input.hasOwnProperty("prefix")) filters.prefix = input.prefix;
      if (input.hasOwnProperty("ownerCasa")) filters.ownerCasa = input.ownerCasa;
      if (input.hasOwnProperty("providerType")) filters.providerType = input.providerType;
      if (input.hasOwnProperty("type")) filters.type = input.type;
      if (input.hasOwnProperty("scope")) filters.scope = input.scope;
      if (input.hasOwnProperty("connected")) filters.connected = !!input.connected;
      if (input.hasOwnProperty("bowed")) filters.bowed = !!input.bowed;
      if (input.hasOwnProperty("activeOnly")) filters.activeOnly = !!input.activeOnly;
      if (input.hasOwnProperty("includeInstances")) filters.includeInstances = !!input.includeInstances;
      if (input.hasOwnProperty("limit")) filters.limit = parseInt(input.limit);
      if (input.hasOwnProperty("query")) filters.query = input.query;
      return filters;
   }

   for (var i = 0; i < _params.length; ++i) {
      var token = _params[i];

      if (typeof token !== "string") {
         continue;
      }

      if (token[0] === ":") {
         filters.prefix = token;
      }
      else if (token === "active") {
         filters.activeOnly = true;
      }
      else if (token === "bowed") {
         filters.bowed = true;
      }
      else if (token === "connected") {
         filters.connected = true;
      }
      else if (token === "disconnected") {
         filters.connected = false;
      }
      else if (token === "instances") {
         filters.includeInstances = true;
      }
      else if (token.startsWith("owner=")) {
         filters.ownerCasa = token.substr(6);
      }
      else if (token.startsWith("provider=")) {
         filters.providerType = token.substr(9);
      }
      else if (token.startsWith("type=")) {
         filters.type = token.substr(5);
      }
      else if (token.startsWith("scope=")) {
         filters.scope = token.substr(6);
      }
      else if (token.startsWith("limit=")) {
         filters.limit = parseInt(token.substr(6));
      }
      else {
         filters.query = token;
      }
   }

   return filters;
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

function findActiveInstance(_resolved) {

   if (!_resolved || !_resolved.instances) {
      return null;
   }

   for (var i = 0; i < _resolved.instances.length; ++i) {

      if (_resolved.instances[i].state === "active") {
         return _resolved.instances[i];
      }
   }

   return null;
}

function resolvedMatchesFilters(_resolved, _filters) {

   if (!_resolved || !_filters) {
      return true;
   }

   if (_filters.prefix && !_resolved.sourceUName.startsWith(_filters.prefix)) {
      return false;
   }

   var active = findActiveInstance(_resolved);

   if (_filters.activeOnly && !active) {
      return false;
   }

   if (_filters.ownerCasa && (!active || (active.ownerCasa !== _filters.ownerCasa))) {
      return false;
   }

   if (_filters.providerType && (!active || (active.providerType !== _filters.providerType))) {
      return false;
   }

   if (_filters.type && (!active || (active.type !== _filters.type))) {
      return false;
   }

   if (_filters.scope && (!active || (active.scope !== _filters.scope))) {
      return false;
   }

   var hasBowed = _resolved.instances.some( (_instance) => _instance.state === "bowed");

   if ((_filters.bowed === true) && !hasBowed) {
      return false;
   }
   else if ((_filters.bowed === false) && hasBowed) {
      return false;
   }

   var hasConnected = _resolved.instances.some( (_instance) => !!_instance.connected);

   if ((_filters.connected === true) && !hasConnected) {
      return false;
   }
   else if ((_filters.connected === false) && hasConnected) {
      return false;
   }

   if (_filters.query) {
      var q = _filters.query.toLowerCase();
      var qFound = _resolved.sourceUName.toLowerCase().indexOf(q) !== -1;

      if (!qFound) {

         for (var i = 0; i < _resolved.instances.length; ++i) {
            var inst = _resolved.instances[i];

            if ((inst.ownerCasa && (inst.ownerCasa.toLowerCase().indexOf(q) !== -1)) ||
                (inst.type && (inst.type.toLowerCase().indexOf(q) !== -1)) ||
                (inst.scope && (inst.scope.toLowerCase().indexOf(q) !== -1))) {
               qFound = true;
               break;
            }
         }
      }

      if (!qFound) {
         return false;
      }
   }

   return true;
}

function normaliseSourceListLimit(_limit) {
   var limit = parseInt(_limit);

   if (!limit || (limit < 0)) {
      return 0;
   }

   return limit;
}

// Called when current state required
GangConsoleApi.prototype.export = function(_exportObj) {
   ConsoleApi.prototype.export.call(this, _exportObj);
};

// Called to restore current state
GangConsoleApi.prototype.import = function(_importObj) {
   ConsoleApi.prototype.import.call(this, _importObj);
};

GangConsoleApi.prototype.coldStart = function() {
   ConsoleApi.prototype.coldStart.call(this);
};

GangConsoleApi.prototype.hotStart = function() {
   ConsoleApi.prototype.hotStart.call(this);
};

GangConsoleApi.prototype.cat = function(_session, _params, _callback) {
   _callback(null, {});
};

GangConsoleApi.prototype.createUser = function(_session, _params, _callback) {

   if (params.length < 1) {
       return _callback("Name not passed as a parameter");
   }

   if (!this.gang.findNamedObject(_params[0])) {
      var userObj = this.gang.createUser({name: _params[0], type: "user"});
      return _callback(null, true);
   }
   else {
      return _callback(null, false);
   }
};

GangConsoleApi.prototype.reboot = function(_session, _params, _callback) {

   if ((_params && (_params.length > 0) && _params[0]) || (!this.gang.ignoreRestart)) {
      require('reboot').reboot();
      return _callback("Unable to reboot - insufficient permissions!");
   }
   else {
      return _callback(this.gang.casa.uName + ": Ignoring reboot!");
   }
};

GangConsoleApi.prototype.restart = function(_session, _params, _callback) {

   if (this.gang.ignoreRestart) {
      return _callback(this.gang.casa.uName + ": Ignoring restart!");
   }
   else if (_params && (_params.length > 0) && _params[0]) {
      process.exit(3);
   }
   else {
      //this.gang.suspend();
      process.exit(3);
   }
};

GangConsoleApi.prototype.updateDb = function(_session, _params, _callback) {
   this.checkParams(2, _params);

   var dbName = (_params.length > 2) ? _params[2] : this.gang.name;
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

GangConsoleApi.prototype.updateDbs = function(_session, _params, _callback) {
   this.checkParams(2, _params);
   this.updateDb(_session, _params, (_err, _result) => {

      if (_err)  {
         _callback(_err);
      }
      else {
         _params.push(this.gang.casa.name);
         this.updateDb(_session, _params, _callback);
      }
   });
};

GangConsoleApi.prototype.exportDb = function(_session, _params, _callback) {
   this.gang.getDb().readAll(_callback);
};

GangConsoleApi.prototype.topology = function(_session, _params, _callback) {
   var localCounts = collectLocalSourceCounts(this.gang);
   var peers = [];

   for (var peerName in this.gang.peercasas) {

      if (this.gang.peercasas.hasOwnProperty(peerName)) {
         var peerCasa = this.gang.peercasas[peerName];
         var peerCounts = collectPeerSourceCounts(peerCasa);

         peers.push({
            casaName: peerCasa.name,
            connected: !!peerCasa.connected,
            host: (peerCasa.address && (peerCasa.address.host || peerCasa.address.hostname)) ? (peerCasa.address.host || peerCasa.address.hostname) : null,
            port: (peerCasa.address && peerCasa.address.port) ? peerCasa.address.port : null,
            discoveryTier: (peerCasa.discoveryTier !== undefined) ? peerCasa.discoveryTier : null,
            sourceCounts: peerCounts,
            sourceTotal: peerCounts.total,
            sourceActive: peerCounts.active,
            sourceBowed: peerCounts.bowed,
            sourceDisconnected: Math.max(0, peerCounts.total - peerCounts.active - peerCounts.bowed)
         });
      }
   }

   peers.sort( (_a, _b) => (_a.casaName > _b.casaName) ? 1 : ((_a.casaName < _b.casaName) ? -1 : 0));
   var localBowed = (localCounts && (typeof localCounts.bowed === "number")) ? localCounts.bowed : 0;
   var peerActive = peers.reduce( (_count, _peer) => {
      return _count + ((_peer.sourceCounts && (typeof _peer.sourceCounts.active === "number")) ? _peer.sourceCounts.active : 0);
   }, 0);
   var peerBowed = peers.reduce( (_count, _peer) => {
      return _count + ((_peer.sourceCounts && (typeof _peer.sourceCounts.bowed === "number")) ? _peer.sourceCounts.bowed : 0);
   }, 0);

   _callback(null, {
      gangName: this.gang.name,
      localCasaName: this.gang.casa.name,
      localSourceCounts: localCounts,
      localBowed: localBowed,
      peerActive: peerActive,
      peerBowed: peerBowed,
      totalBowed: localBowed + peerBowed,
      peerCount: peers.length,
      connectedPeerCount: peers.reduce( (_count, _peer) => _count + (_peer.connected ? 1 : 0), 0),
      peers: peers
   });
};

GangConsoleApi.prototype.getSourceObjectForUName = function(_sourceUName) {
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

GangConsoleApi.prototype.getSourceConsoleApiForUName = function(_sourceUName) {
   var sourceObj = this.getSourceObjectForUName(_sourceUName);

   if (!sourceObj || !this.consoleApiService || (typeof this.consoleApiService.findOrCreateConsoleApiObject !== "function")) {
      return null;
   }

   return this.consoleApiService.findOrCreateConsoleApiObject(sourceObj);
};

GangConsoleApi.prototype.resolveSourceInternal = function(_sourceUName) {
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

GangConsoleApi.prototype.resolveSource = function(_session, _params, _callback) {
   this.checkParams(1, _params);

   var sourceUName = normaliseSourceUName(_params[0]);

   if (!sourceUName) {
      return _callback("Invalid source uName");
   }

   _callback(null, this.resolveSourceInternal(sourceUName));
};

GangConsoleApi.prototype.sourceTreeState = function(_session, _params, _callback) {
   this.checkParams(1, _params);

   var sourceUName = normaliseSourceUName(_params[0]);

   if (!sourceUName) {
      return _callback("Invalid source uName");
   }

   var activeSource = this.gang.findNamedObject(sourceUName);
   var localBowSource = this.gang.casa.bowingRoot ? this.gang.casa.bowingRoot.findNamedObject(sourceUName) : null;
   var peers = [];

   for (var peerName in this.gang.peercasas) {

      if (this.gang.peercasas.hasOwnProperty(peerName)) {
         var peerCasa = this.gang.peercasas[peerName];
         var peerRootSource = peerCasa.peerRoot ? peerCasa.peerRoot.findNamedObject(sourceUName) : null;

         peers.push({
            casaName: peerCasa.name,
            connected: !!peerCasa.connected,
            inPeerRoot: !!peerRootSource,
            peerRootOwnerUName: peerRootSource && peerRootSource.owner ? peerRootSource.owner.uName : null,
            peerRootType: peerRootSource ? peerRootSource.type : null,
            peerRootSuperType: peerRootSource && (typeof peerRootSource.superType === "function") ? peerRootSource.superType() : null,
            peerRootBowing: peerRootSource ? !!peerRootSource.bowing : null,
            peerRootPriority: peerRootSource && (peerRootSource.priority !== undefined) ? peerRootSource.priority : null
         });
      }
   }

   peers.sort( (_a, _b) => (_a.casaName > _b.casaName) ? 1 : ((_a.casaName < _b.casaName) ? -1 : 0));

   _callback(null, {
      sourceUName: sourceUName,
      active: {
         exists: !!activeSource,
         ownerUName: activeSource && activeSource.owner ? activeSource.owner.uName : null,
         ownerCasa: activeSource && activeSource.casa ? activeSource.casa.name : null,
         type: activeSource ? activeSource.type : null,
         superType: activeSource && (typeof activeSource.superType === "function") ? activeSource.superType() : null,
         bowing: activeSource ? !!activeSource.bowing : null,
         priority: activeSource && (activeSource.priority !== undefined) ? activeSource.priority : null
      },
      localBow: {
         exists: !!localBowSource,
         ownerUName: localBowSource && localBowSource.owner ? localBowSource.owner.uName : null,
         ownerCasa: localBowSource && localBowSource.casa ? localBowSource.casa.name : null,
         type: localBowSource ? localBowSource.type : null,
         superType: localBowSource && (typeof localBowSource.superType === "function") ? localBowSource.superType() : null,
         bowing: localBowSource ? !!localBowSource.bowing : null,
         priority: localBowSource && (localBowSource.priority !== undefined) ? localBowSource.priority : null
      },
      peers: peers
   });
};

GangConsoleApi.prototype.explainSourceInternal = function(_sourceUName) {
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

GangConsoleApi.prototype.explainSource = function(_session, _params, _callback) {
   this.checkParams(1, _params);

   var sourceUName = normaliseSourceUName(_params[0]);

   if (!sourceUName) {
      return _callback("Invalid source uName");
   }

   _callback(null, this.explainSourceInternal(sourceUName));
};

GangConsoleApi.prototype.sourceUsageInternal = function(_sourceUName, _options) {
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

GangConsoleApi.prototype.sourceUsage = function(_session, _params, _callback) {
   this.checkParams(1, _params);

   var sourceUName = normaliseSourceUName(_params[0]);
   var options = (_params.length > 1) ? _params[1] : {};

   if (!sourceUName) {
      return _callback("Invalid source uName");
   }

   _callback(null, this.sourceUsageInternal(sourceUName, options));
};

GangConsoleApi.prototype.listSources = function(_session, _params, _callback) {
   var filters = parseListSourcesFilters(_params);
   var limit = normaliseSourceListLimit(filters.limit);
   var sourceUNames = {};
   var sortedUNames;
   var sources = [];

   collectKnownSourceUNames(this.gang, sourceUNames);

   sortedUNames = Object.keys(sourceUNames).sort();

   for (var i = 0; i < sortedUNames.length; ++i) {
      var resolved = this.resolveSourceInternal(sortedUNames[i]);

      if (!resolved.exists || !resolvedMatchesFilters(resolved, filters)) {
         continue;
      }

      var active = findActiveInstance(resolved);
      var bowedCount = resolved.instances.reduce( (_acc, _instance) => _acc + ((_instance.state === "bowed") ? 1 : 0), 0);
      var disconnectedCount = resolved.instances.reduce( (_acc, _instance) => _acc + (!_instance.connected ? 1 : 0), 0);
      var summary = {
         sourceUName: resolved.sourceUName,
         activeOwnerCasa: resolved.activeOwnerCasa,
         activeProviderType: resolved.activeProviderType,
         activePriority: active ? active.priority : null,
         instanceCount: resolved.instances.length,
         bowedCount: bowedCount,
         disconnectedCount: disconnectedCount
      };

      if (filters.includeInstances) {
         summary.instances = resolved.instances;
      }

      sources.push(summary);

      if (limit && (sources.length >= limit)) {
         break;
      }
   }

   _callback(null, {
      count: sources.length,
      totalKnownSources: sortedUNames.length,
      filters: filters,
      sources: sources
   });
};

GangConsoleApi.prototype.sourceTrees = function(_session, _params, _callback) {
   var casaApi = null;

   if (this.consoleApiService && (typeof this.consoleApiService.findOrCreateConsoleApiObject === "function")) {
      casaApi = this.consoleApiService.findOrCreateConsoleApiObject(this.gang.casa);
   }

   if (!casaApi || (typeof casaApi.sourceTreesInternal !== "function")) {
      return _callback("Unable to build source trees");
   }

   _callback(null, casaApi.sourceTreesInternal());
};

GangConsoleApi.prototype.configuredSourceTree = function(_session, _params, _callback) {
   var casaApi = null;

   if (this.consoleApiService && (typeof this.consoleApiService.findOrCreateConsoleApiObject === "function")) {
      casaApi = this.consoleApiService.findOrCreateConsoleApiObject(this.gang.casa);
   }

   if (!casaApi || (typeof casaApi.configuredSourceTreeInternal !== "function")) {
      return _callback("Unable to build configured source tree");
   }

   _callback(null, casaApi.configuredSourceTreeInternal());
};

GangConsoleApi.prototype.previewConfigInternal = function(_options) {
   return ConfigPreviewEngine.previewConfig(_options ? _options : {}, {
      mode: "gang",
      gang: this.gang,
      gangName: this.gang.name,
      defaultCasaName: this.gang.casa.name,
      targetCasaName: (_options && _options.targetCasaName) ? _options.targetCasaName : null,
      resolveSourceFn: this.resolveSourceInternal.bind(this),
      sourceUsageFn: this.sourceUsageInternal.bind(this)
   });
};

GangConsoleApi.prototype.previewConfig = function(_session, _params, _callback) {
   var options = (_params && (_params.length > 0)) ? _params[0] : {};

   if (!options || ((typeof options !== "object") || (options instanceof Array))) {
      options = {};
   }

   var emitProgress = !!(options.progress || options.emitProgress);

   if (!emitProgress) {
      return _callback(null, this.previewConfigInternal(options));
   }

   var targetCasaName = options.targetCasaName ? options.targetCasaName : this.gang.casa.name;

   return ConfigPreviewEngine.previewConfigAsync(options, {
      mode: "gang",
      gang: this.gang,
      gangName: this.gang.name,
      defaultCasaName: this.gang.casa.name,
      targetCasaName: options.targetCasaName ? options.targetCasaName : null,
      resolveSourceFn: this.resolveSourceInternal.bind(this),
      sourceUsageFn: this.sourceUsageInternal.bind(this)
   }, (_event) => {
      emitPreviewProgress(this, _session, "gang", targetCasaName, _event);
   }, (_result) => {
      _callback(null, _result);
   });
};

GangConsoleApi.prototype.resolveSources = function(_session, _params, _callback) {
   this.checkParams(1, _params);

   var sourceNames = (_params[0] instanceof Array) ? _params[0] : _params;

   if (sourceNames.length > MAX_RESOLVE_BATCH) {
      return _callback("Too many source names requested. Max batch size is " + MAX_RESOLVE_BATCH);
   }

   var results = [];

   for (var i = 0; i < sourceNames.length; ++i) {
      var sourceUName = normaliseSourceUName(sourceNames[i]);

      if (!sourceUName) {
         results.push({ sourceUName: sourceNames[i], exists: false, error: "Invalid source uName" });
      }
      else {
         results.push(this.resolveSourceInternal(sourceUName));
      }
   }

   _callback(null, results);
};

module.exports = exports = GangConsoleApi;
 
