var util = require('util');
var ConsoleApi = require('../consoleapi');
var SourceListener = require('../sourcelistener');
var dateFormat = require ('dateformat');

function SourceBaseConsoleApi(_config, _owner) {
   ConsoleApi.call(this, _config, _owner);
   this.sourceListeners = {};
}

util.inherits(SourceBaseConsoleApi, ConsoleApi);

function sbGetSourceProviderType(_source) {

   if (_source && _source.casa && (typeof _source.casa.superType === "function")) {
      return _source.casa.superType();
   }

   return "unknown";
}

function sbGetSourceOwnerCasa(_source, _fallbackCasa) {

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

function sbGetSourceScope(_source, _gangName, _localCasaName) {
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

function sbGetObjectType(_obj) {

   if (!_obj) {
      return "unknown";
   }

   if (_obj.type) {
      return _obj.type;
   }

   if (_obj.config && _obj.config.type) {
      return _obj.config.type;
   }

   if (typeof _obj.superType === "function") {
      return _obj.superType();
   }

   return "unknown";
}

function sbFindInstanceMeta(_instances, _source) {

   if (!_source) {
      return -1;
   }

   for (var i = 0; i < _instances.length; ++i) {

      if (_instances[i].source === _source) {
         return i;
      }
   }

   return -1;
}

function sbAppendInstanceMeta(_instances, _source, _inSources, _inBowing) {

   if (!_source) {
      return;
   }

   var existingIndex = sbFindInstanceMeta(_instances, _source);

   if (existingIndex === -1) {
      _instances.push({ source: _source, inSources: !!_inSources, inBowing: !!_inBowing });
   }
   else {
      _instances[existingIndex].inSources = _instances[existingIndex].inSources || !!_inSources;
      _instances[existingIndex].inBowing = _instances[existingIndex].inBowing || !!_inBowing;
   }
}

function sbAppendSourceFromRoot(_instances, _root, _sourceUName, _inSources, _inBowing) {

   if (!_root || !_sourceUName || (typeof _root.findNamedObject !== "function")) {
      return;
   }

   sbAppendInstanceMeta(_instances, _root.findNamedObject(_sourceUName), _inSources, _inBowing);
}

function sbAppendSourcesFromMap(_instances, _sourceMap, _sourceUName, _inSources, _inBowing) {

   if (!_sourceMap) {
      return;
   }

   if (_sourceUName) {

      if (_sourceMap.hasOwnProperty(_sourceUName) && _sourceMap[_sourceUName]) {
         sbAppendInstanceMeta(_instances, _sourceMap[_sourceUName], _inSources, _inBowing);
      }

      for (var topSourceName in _sourceMap) {

         if (_sourceMap.hasOwnProperty(topSourceName) && _sourceMap[topSourceName] && (topSourceName !== _sourceUName) &&
             (typeof _sourceMap[topSourceName].findNamedObject === "function")) {
            var nestedSource = _sourceMap[topSourceName].findNamedObject(_sourceUName);

            if (nestedSource) {
               sbAppendInstanceMeta(_instances, nestedSource, _inSources, _inBowing);
            }
         }
      }
   }
   else {
      for (var sourceName in _sourceMap) {

         if (_sourceMap.hasOwnProperty(sourceName) && _sourceMap[sourceName]) {
            sbAppendInstanceMeta(_instances, _sourceMap[sourceName], _inSources, _inBowing);
         }
      }
   }
}

function sbAppendContainerInstances(_instances, _container, _sourceUName, _activeSource) {

   if (!_container) {
      return;
   }

   var containerType = (typeof _container.superType === "function") ? _container.superType() : null;

   if (containerType === "casa") {
      if (_activeSource && (typeof _activeSource.getCasa === "function") && (_activeSource.getCasa() === _container) &&
          (_activeSource.type !== "peersource")) {
         sbAppendInstanceMeta(_instances, _activeSource, true, false);
      }

      sbAppendSourceFromRoot(_instances, _container.bowingRoot, _sourceUName, false, true);
      return;
   }

   if (containerType === "peercasa") {
      if (_activeSource && (typeof _activeSource.getCasa === "function") && (_activeSource.getCasa() === _container) &&
          (_activeSource.type === "peersource")) {
         sbAppendInstanceMeta(_instances, _activeSource, true, false);
      }

      sbAppendSourceFromRoot(_instances, _container.peerRoot, _sourceUName, false, true);
      return;
   }

   sbAppendSourcesFromMap(_instances, _container.sources, _sourceUName, true, false);
   sbAppendSourcesFromMap(_instances, _container.bowingSources, _sourceUName, false, true);
}

function sbFindActiveInstance(_resolved) {

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

function sbNormaliseSourceUName(_uName) {

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

function sbCollectSubscribedSources(_source) {
   var consumers = [];
   var subscriptionCount = 0;

   if (_source && _source.subscribedSources) {

      for (var consumerUName in _source.subscribedSources) {

         if (_source.subscribedSources.hasOwnProperty(consumerUName)) {
            var count = parseInt(_source.subscribedSources[consumerUName]);

            if (!count || (count < 0)) {
               count = 0;
            }

            subscriptionCount += count;
            consumers.push({ sourceUName: consumerUName, count: count });
         }
      }
   }

   consumers.sort( (_a, _b) => {
      if (_a.count > _b.count) {
         return -1;
      }
      else if (_a.count < _b.count) {
         return 1;
      }
      else if (_a.sourceUName > _b.sourceUName) {
         return 1;
      }
      else if (_a.sourceUName < _b.sourceUName) {
         return -1;
      }

      return 0;
   });

   return {
      consumerCount: consumers.length,
      subscriptionCount: subscriptionCount,
      consumers: consumers
   };
}

function sbNormaliseUsageOptions(_options) {
   var options = ((typeof _options === "object") && !(_options instanceof Array) && _options) ? _options : {};

   return {
      activeOnly: !!options.activeOnly,
      hasConsumers: !!options.hasConsumers
   };
}

function sbBuildUsageInstanceEntry(_source, _instanceMeta, _activeSource, _gangName, _localCasaName) {
   var ownerCasa = sbGetSourceOwnerCasa(_source, _localCasaName);
   var providerType = sbGetSourceProviderType(_source);
   var connected = (providerType === "peercasa") ? !!(_source.casa && _source.casa.connected) : true;
   var usage = sbCollectSubscribedSources(_source);
   var state = "error";
   var error = null;

   if (_instanceMeta && _instanceMeta.inBowing) {
      state = "bowed";
   }
   else if (_activeSource && (_source === _activeSource) && !_source.bowing) {
      state = "active";
   }
   else if (!connected) {
      state = "unavailable";
   }
   else {
      error = "Invalid source state: connected instance is neither active nor bowed";
   }

   return {
      ownerCasa: ownerCasa,
      providerType: providerType,
      type: sbGetObjectType(_source),
      superType: (typeof _source.superType === "function") ? _source.superType() : null,
      priority: (_source.priority !== undefined) ? _source.priority : 0,
      state: state,
      connected: connected,
      scope: sbGetSourceScope(_source, _gangName, _localCasaName),
      inSourcesMap: _instanceMeta ? !!_instanceMeta.inSources : true,
      inBowingMap: _instanceMeta ? !!_instanceMeta.inBowing : false,
      error: error,
      consumerCount: usage.consumerCount,
      subscriptionCount: usage.subscriptionCount,
      consumers: usage.consumers
   };
}

SourceBaseConsoleApi.prototype.resolveForUName = function(_sourceUName) {
   var activeSource = null;
   var instanceMetas = [];
   var activeOwnerCasa = null;
   var activeProviderType = null;
   var gang = this.gang;
   var localCasaName = (gang && gang.casa) ? gang.casa.name : null;
   var outputInstances = [];
   var errors = [];

   if (!gang || !_sourceUName) {
      return {
         sourceUName: _sourceUName,
         exists: false,
         activeOwnerCasa: null,
         activeProviderType: null,
         errors: [],
         instances: []
      };
   }

   activeSource = gang.findNamedObject(_sourceUName);

   sbAppendContainerInstances(instanceMetas, gang.casa, _sourceUName, activeSource);

   for (var peerName in gang.peercasas) {

      if (gang.peercasas.hasOwnProperty(peerName)) {
         sbAppendContainerInstances(instanceMetas, gang.peercasas[peerName], _sourceUName, activeSource);
      }
   }

   for (var i = 0; i < instanceMetas.length; ++i) {
      var source = instanceMetas[i].source;
      var ownerCasa = sbGetSourceOwnerCasa(source, localCasaName);
      var providerType = sbGetSourceProviderType(source);
      var connected = (providerType === "peercasa") ? !!(source.casa && source.casa.connected) : true;
      var state = "error";

      if (instanceMetas[i].inBowing) {
         state = "bowed";
      }
      else if (activeSource && (source === activeSource) && !source.bowing) {
         state = "active";
         activeOwnerCasa = ownerCasa;
         activeProviderType = providerType;
      }
      else if (!connected) {
         state = "unavailable";
      }
      else {
         errors.push(_sourceUName + ": instance owner=\"" + ownerCasa + "\" provider=\"" + providerType + "\" is connected but neither active nor bowed");
      }

      outputInstances.push({
         ownerCasa: ownerCasa,
         providerType: providerType,
         type: sbGetObjectType(source),
         superType: (typeof source.superType === "function") ? source.superType() : null,
         priority: (source.priority !== undefined) ? source.priority : 0,
         state: state,
         inSourcesMap: !!instanceMetas[i].inSources,
         inBowingMap: !!instanceMetas[i].inBowing,
         connected: connected,
         scope: sbGetSourceScope(source, gang.name, localCasaName)
      });
   }

   if ((outputInstances.length === 0) && activeSource && (typeof activeSource.getCasa === "function")) {
      activeOwnerCasa = sbGetSourceOwnerCasa(activeSource, localCasaName);
      activeProviderType = sbGetSourceProviderType(activeSource);

      outputInstances.push({
         ownerCasa: activeOwnerCasa,
         providerType: activeProviderType,
         type: sbGetObjectType(activeSource),
         superType: (typeof activeSource.superType === "function") ? activeSource.superType() : null,
         priority: (activeSource.priority !== undefined) ? activeSource.priority : 0,
         state: "active",
         inSourcesMap: true,
         inBowingMap: false,
         connected: true,
         scope: sbGetSourceScope(activeSource, gang.name, localCasaName)
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
      errors: errors,
      instances: outputInstances
   };
};

SourceBaseConsoleApi.prototype.explainForUName = function(_sourceUName) {
   var resolved = this.resolveForUName(_sourceUName);
   var activeInstance = sbFindActiveInstance(resolved);
   var contenders = [];
   var fallback = null;

   if (!resolved.exists) {
      return {
         sourceUName: _sourceUName,
         exists: false,
         reason: "Source not found in active tree or bowed trees"
      };
   }

   for (var i = 0; i < resolved.instances.length; ++i) {
      var instance = resolved.instances[i];
      var reasons = [];

      if (instance.state === "active") {
         reasons.push("selected-active");
      }
      else {

         if (!instance.connected) {
            reasons.push("disconnected");
         }

         if (instance.state === "bowed") {
            reasons.push("bowed");
         }
         else if (instance.state === "error") {
            reasons.push("invalid-state-non-active-non-bowed");
         }

         if (activeInstance) {

            if (instance.priority < activeInstance.priority) {
               reasons.push("lower-priority-than-active");
            }
            else if ((instance.priority === activeInstance.priority) && (instance.ownerCasa !== activeInstance.ownerCasa)) {
               reasons.push("tie-break-owner-casa");
            }
         }

         if (reasons.length === 0) {
            reasons.push("not-selected");
         }
      }

      contenders.push({
         ownerCasa: instance.ownerCasa,
         providerType: instance.providerType,
         type: instance.type,
         superType: instance.superType,
         priority: instance.priority,
         state: instance.state,
         connected: instance.connected,
         inSourcesMap: instance.inSourcesMap,
         inBowingMap: instance.inBowingMap,
         scope: instance.scope,
         reasons: reasons
      });

      if (!fallback && (instance.state !== "active") && instance.connected && (instance.state !== "bowed")) {
         fallback = {
            ownerCasa: instance.ownerCasa,
            providerType: instance.providerType,
            priority: instance.priority,
            type: instance.type
         };
      }
   }

   return {
      sourceUName: _sourceUName,
      exists: true,
      activeOwnerCasa: resolved.activeOwnerCasa,
      activeProviderType: resolved.activeProviderType,
      activePriority: activeInstance ? activeInstance.priority : null,
      rule: "Highest priority connected instance wins; bowed instances are passive",
      errors: resolved.errors ? resolved.errors : [],
      fallback: fallback,
      contenders: contenders
   };
};

SourceBaseConsoleApi.prototype.usageForUName = function(_sourceUName, _options) {
   var sourceUName = sbNormaliseSourceUName(_sourceUName);
   var options = sbNormaliseUsageOptions(_options);
   var gang = this.gang;
   var localCasaName = (gang && gang.casa) ? gang.casa.name : null;
   var resolved;
   var instanceMetas = [];
   var activeSource = null;
   var instances = [];
   var consumerSet = {};
   var totalSubscriptionCount = 0;
   var errors = [];

   if (!sourceUName || !gang) {
      return {
         sourceUName: sourceUName,
         exists: false,
         activeOwnerCasa: null,
         activeProviderType: null,
         instanceCount: 0,
         consumerCount: 0,
         subscriptionCount: 0,
         filters: options,
         errors: [],
         instances: []
      };
   }

   resolved = this.resolveForUName(sourceUName);

   if (!resolved.exists) {
      return {
         sourceUName: sourceUName,
         exists: false,
         activeOwnerCasa: null,
         activeProviderType: null,
         instanceCount: 0,
         consumerCount: 0,
         subscriptionCount: 0,
         filters: options,
         reason: "Source not found in active tree or bowed trees",
         errors: resolved.errors ? resolved.errors : [],
         instances: []
      };
   }

   if (resolved.errors && (resolved.errors.length > 0)) {
      errors = resolved.errors.slice();
   }

   activeSource = gang.findNamedObject(sourceUName);

   sbAppendContainerInstances(instanceMetas, gang.casa, sourceUName, activeSource);

   for (var peerName in gang.peercasas) {

      if (gang.peercasas.hasOwnProperty(peerName)) {
         sbAppendContainerInstances(instanceMetas, gang.peercasas[peerName], sourceUName, activeSource);
      }
   }

   for (var i = 0; i < instanceMetas.length; ++i) {
      var instance = sbBuildUsageInstanceEntry(instanceMetas[i].source, instanceMetas[i], activeSource, gang.name, localCasaName);

      if (instance.error) {
         errors.push(sourceUName + ": " + instance.error + " (owner=\"" + instance.ownerCasa + "\", provider=\"" + instance.providerType + "\")");
      }

      if (options.activeOnly && (instance.state !== "active")) {
         continue;
      }

      if (options.hasConsumers && (instance.subscriptionCount === 0)) {
         continue;
      }

      instances.push(instance);
      totalSubscriptionCount += instance.subscriptionCount;

      for (var c = 0; c < instance.consumers.length; ++c) {
         consumerSet[instance.consumers[c].sourceUName] = true;
      }
   }

   if ((instances.length === 0) && activeSource && (typeof activeSource.getCasa === "function")) {
      var activeOnlyInstance = sbBuildUsageInstanceEntry(activeSource, null, activeSource, gang.name, localCasaName);

      if (!options.hasConsumers || (activeOnlyInstance.subscriptionCount > 0)) {
         instances.push(activeOnlyInstance);
         totalSubscriptionCount += activeOnlyInstance.subscriptionCount;

         for (var c2 = 0; c2 < activeOnlyInstance.consumers.length; ++c2) {
            consumerSet[activeOnlyInstance.consumers[c2].sourceUName] = true;
         }
      }
   }

   instances.sort( (_a, _b) => {
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
      sourceUName: sourceUName,
      exists: true,
      activeOwnerCasa: resolved.activeOwnerCasa,
      activeProviderType: resolved.activeProviderType,
      instanceCount: instances.length,
      consumerCount: Object.keys(consumerSet).length,
      subscriptionCount: totalSubscriptionCount,
      filters: options,
      errors: errors,
      instances: instances
   };
};

// Called when current state required
SourceBaseConsoleApi.prototype.export = function(_exportObj) {
   ConsoleApi.prototype.export.call(this, _exportObj);
};

// Called to restore current state
SourceBaseConsoleApi.prototype.import = function(_importObj) {
   ConsoleApi.prototype.import.call(this, _importObj);
};

SourceBaseConsoleApi.prototype.coldStart = function() {
   ConsoleApi.prototype.coldStart.call(this);
};

SourceBaseConsoleApi.prototype.hotStart = function() {
   ConsoleApi.prototype.hotStart.call(this);
};

SourceBaseConsoleApi.prototype.exportData = function(_session, _params, _callback) {
   var exportData = {};

   if (this.myObj().exportTree(exportData)) {
      console.info("AAAAAA export=", exportData);
      _callback(null, exportData);
   }
   else {
      _callback("No objects to export!");
   }
};

SourceBaseConsoleApi.prototype.cat = function(_session, _params, _callback) {
   var output = [];

   for (var prop in this.myObj().properties) {

      if (this.myObj().properties.hasOwnProperty(prop)) {
         output.push(this.myObj().properties[prop].name+"="+this.myObj().properties[prop].getValue());
      }
   }
   _callback(null, output);
};

SourceBaseConsoleApi.prototype.findOrCreateSourceListener = function(_name) {

   if (!this.sourceListeners.hasOwnProperty(_name)) {
      this.sourceListeners[_name] = { refCount: 1, sourceListener: new SourceListener({ uName: this.uName, listeningSource: ":", property: _name }, this) };
      this.sourceListeners[_name].sourceListener.establishListeners();
   }
   else {
      this.sourceListeners[_name].refCount = this.sourceListeners[_name].refCount + 1;
   }
   return this.sourceListeners[_name].sourceListener;
};

SourceBaseConsoleApi.prototype.removeListener = function(_name) {

   if (this.sourceListeners.hasOwnProperty(_name)) {
      this.sourceListeners[_name].refCount = this.sourceListeners[_name].refCount - 1;

      if (this.sourceListeners[_name].refCount === 0) {
         this.sourceListeners[_name].sourceListener.stopListening();
         delete this.sourceListeners[_name].sourceListener;
         delete this.sourceListeners[_name];
      }
   }
};

SourceBaseConsoleApi.prototype.getWatchList = function(_session) {
   var sessionObj = this.getSessionObj(_session);

   if (!sessionObj.hasOwnProperty("watchList")) {
      sessionObj.watchList = {};
   }
   return sessionObj.watchList;
};

SourceBaseConsoleApi.prototype.watching = function(_session, _params, _callback) {
   var output = [];
   var watchList = this.getWatchList(_session);

   for (var prop in watchList) {

      if (watchList.hasOwnProperty(prop)) {
         output.push(prop);
      }
   }
   return _callback(null, output);
};

SourceBaseConsoleApi.prototype.watch = function(_session, _params, _callback) {
   this.checkParams(1, _params);

   var watchList = this.getWatchList(_session);

   if (watchList.hasOwnProperty(_params[0])) {
      return _callback("Already watching \""+_params[0]+"\"");
   }
   else if (this.myObj() && this.myObj().properties.hasOwnProperty(_params[0])) {
      watchList[_params[0]] = this.findOrCreateSourceListener(_params[0]);
      return _callback(null, "Watching \""+_params[0]+"\"");
   }
   else {
      return _callback(null, "Property not found!");
   }
};

SourceBaseConsoleApi.prototype.unwatch = function(_session, _params, _callback) {
   this.checkParams(1, _params);

   var watchList = this.getWatchList(_session);

   if (!watchList.hasOwnProperty(_params[0])) {
      return _callback("Not currently watching \""+_params[0]+"\"");
   }
   else {
      this.removeListener(_params[0]);
      delete watchList[_params[0]];
      return _callback(null, "Finished watching \""+_params[0]+"\"");
   }
};

SourceBaseConsoleApi.prototype.listeners = function(_session, _params, _callback) {
   this.checkParams(1, _params);

   var listeners = this.gang.casa.findListeners(this.uName);
   var listenerUnames = [];

   for (var i=0; i < listeners.length; ++i) {
      if ((listeners[i].owner.type !== "consoleapi") && ((_params[0] == undefined) || (_params[0] === listeners[i].eventName))) {
         listenerUnames.push(listeners[i].owner.uName);
      }
   }

   return _callback(null, listenerUnames);
};

SourceBaseConsoleApi.prototype.sessionClosed = function(_session) {
   var watchList = this.getSessionObj(_session).watchList;

   if (watchList) {

      for (var name in watchList) {
         this.removeListener(name);
         delete watchList[name];
      }
   }

   ConsoleApi.prototype.sessionClosed.call(this, _session);
};

SourceBaseConsoleApi.prototype.sourceIsValid = function(_sourceEventName, _sourceName, _eventName) {
};

SourceBaseConsoleApi.prototype.sourceIsInvalid = function(_data) {
};

SourceBaseConsoleApi.prototype.receivedEventFromSource = function(_data) {

   for (var session in this.sessions) {

       if (this.sessions.hasOwnProperty(session)) {

          if (this.sessions[session].hasOwnProperty("watchList")) {

             if (this.sessions[session].watchList.hasOwnProperty(_data.name)) {
                this.consoleApiService.writeOutput(session, dateFormat() + ": Watched property " + this.uName +":"+_data.name+" changed to "+_data.value);
             }
          }
       }
   }
};

SourceBaseConsoleApi.prototype.resolve = function(_session, _params, _callback) {
   _callback(null, this.resolveForUName(this.uName));
};

SourceBaseConsoleApi.prototype.explain = function(_session, _params, _callback) {
   _callback(null, this.explainForUName(this.uName));
};

SourceBaseConsoleApi.prototype.usage = function(_session, _params, _callback) {
   var options = (_params && (_params.length > 0)) ? _params[0] : {};
   _callback(null, this.usageForUName(this.uName, options));
};

module.exports = exports = SourceBaseConsoleApi;
 
