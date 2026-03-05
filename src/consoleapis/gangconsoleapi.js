var ConsoleApi = require('../consoleapi');
var util = require('util');
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

function getSourceProviderType(_source) {

   if (_source && _source.casa && (typeof _source.casa.superType === "function")) {
      return _source.casa.superType();
   }

   return "unknown";
}

function getSourceOwnerCasa(_source, _fallbackCasa) {

   if (_source && _source.casa && _source.casa.name) {
      return _source.casa.name;
   }

   if (_source && (typeof _source.getCasa === "function")) {
      var casa = _source.getCasa();

      if (casa && casa.name) {
         return casa.name;
      }
   }

   return _fallbackCasa;
}

function getSourceScope(_source, _gangName, _localCasaName) {
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

function collectSourceCounts(_sources) {
   var counts = { total: 0, bowed: 0, active: 0 };

   if (!_sources) {
      return counts;
   }

   for (var sourceUName in _sources) {

      if (_sources.hasOwnProperty(sourceUName) && _sources[sourceUName]) {
         ++counts.total;

         if (_sources[sourceUName].bowing) {
            ++counts.bowed;
         }
         else {
            ++counts.active;
         }
      }
   }

   return counts;
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
   var localCounts = collectSourceCounts(this.gang.casa.sources);
   var peers = [];

   for (var peerName in this.gang.peercasas) {

      if (this.gang.peercasas.hasOwnProperty(peerName)) {
         var peerCasa = this.gang.peercasas[peerName];
         var peerCounts = collectSourceCounts(peerCasa.sources);

         peers.push({
            casaName: peerCasa.name,
            connected: !!peerCasa.connected,
            host: (peerCasa.address && (peerCasa.address.host || peerCasa.address.hostname)) ? (peerCasa.address.host || peerCasa.address.hostname) : null,
            port: (peerCasa.address && peerCasa.address.port) ? peerCasa.address.port : null,
            discoveryTier: (peerCasa.discoveryTier !== undefined) ? peerCasa.discoveryTier : null,
            sourceCounts: peerCounts
         });
      }
   }

   peers.sort( (_a, _b) => (_a.casaName > _b.casaName) ? 1 : ((_a.casaName < _b.casaName) ? -1 : 0));

   _callback(null, {
      gangName: this.gang.name,
      localCasaName: this.gang.casa.name,
      localSourceCounts: localCounts,
      peerCount: peers.length,
      connectedPeerCount: peers.reduce( (_count, _peer) => _count + (_peer.connected ? 1 : 0), 0),
      peers: peers
   });
};

GangConsoleApi.prototype.resolveSourceInternal = function(_sourceUName) {
   var activeSource = null;
   var instances = [];
   var activeOwnerCasa = null;
   var activeProviderType = null;
   var localCasaName = this.gang.casa.name;

   if (this.gang.casa.sources && this.gang.casa.sources.hasOwnProperty(_sourceUName) && this.gang.casa.sources[_sourceUName]) {
      instances.push(this.gang.casa.sources[_sourceUName]);
   }

   for (var peerName in this.gang.peercasas) {

      if (this.gang.peercasas.hasOwnProperty(peerName)) {
         var peerCasa = this.gang.peercasas[peerName];

         if (peerCasa.sources && peerCasa.sources.hasOwnProperty(_sourceUName) && peerCasa.sources[_sourceUName]) {
            instances.push(peerCasa.sources[_sourceUName]);
         }
      }
   }

   if (instances.length > 0) {
      activeSource = this.gang.findNamedObject(_sourceUName);
   }

   var outputInstances = [];

   for (var i = 0; i < instances.length; ++i) {
      var source = instances[i];
      var ownerCasa = getSourceOwnerCasa(source, localCasaName);
      var providerType = getSourceProviderType(source);
      var connected = (providerType === "peercasa") ? !!(source.casa && source.casa.connected) : true;
      var state = "standby";

      if (activeSource && (source === activeSource) && !source.bowing) {
         state = "active";
         activeOwnerCasa = ownerCasa;
         activeProviderType = providerType;
      }
      else if (source.bowing) {
         state = "bowed";
      }
      else if (!connected) {
         state = "unavailable";
      }

      outputInstances.push({
         ownerCasa: ownerCasa,
         providerType: providerType,
         sourceType: (typeof source.superType === "function") ? source.superType() : "unknown",
         priority: (source.priority !== undefined) ? source.priority : 0,
         state: state,
         connected: connected,
         scope: getSourceScope(source, this.gang.name, localCasaName)
      });
   }

   if ((outputInstances.length === 0) && activeSource && (typeof activeSource.getCasa === "function")) {
      activeOwnerCasa = getSourceOwnerCasa(activeSource, localCasaName);
      activeProviderType = getSourceProviderType(activeSource);

      outputInstances.push({
         ownerCasa: activeOwnerCasa,
         providerType: activeProviderType,
         sourceType: (typeof activeSource.superType === "function") ? activeSource.superType() : "unknown",
         priority: (activeSource.priority !== undefined) ? activeSource.priority : 0,
         state: "active",
         connected: true,
         scope: getSourceScope(activeSource, this.gang.name, localCasaName)
      });
   }

   outputInstances.sort( (_a, _b) => {
      if (_a.priority > _b.priority) {
         return -1;
      }
      else if (_a.priority < _b.priority) {
         return 1;
      }
      else if (_a.ownerCasa > _b.ownerCasa) {
         return 1;
      }
      else if (_a.ownerCasa < _b.ownerCasa) {
         return -1;
      }

      return 0;
   });

   return {
      sourceUName: _sourceUName,
      exists: outputInstances.length > 0,
      activeOwnerCasa: activeOwnerCasa,
      activeProviderType: activeProviderType,
      instances: outputInstances
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
 
