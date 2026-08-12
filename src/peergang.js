var util = require('./util');
var NamedObject = require('./namedobject');
var PeerGangSource = require('./peergangsource');

function PeerGang(_config, _owner) {
   _config.transient = true;
   _config.type = "peergang";

   this.localGang = _owner;
   this.gangName = _config.name;
   this.peerGangCasas = {};
   this.sourceListeners = {};
   this.activePeerGangCasaName = null;
   this.sources = {};
   this.sourceOwners = {};
   this.sourceOwnerRequests = {};
   this.sourceOwnerRetryRequired = {};
   this.casaDiscoveryServiceListenersSetUp = false;

   // A PeerGang owns a separate remote gang namespace rooted at ":".
   NamedObject.call(this, _config, ":");
}

util.inherits(PeerGang, NamedObject);

PeerGang.prototype.superType = function(_type) {
   return "peergang";
};

PeerGang.prototype.listenerKey = function(_sourceListener) {
   return _sourceListener.sourceEventName;
};

PeerGang.prototype.refreshSourceListeners = function() {

   for (var key in this.sourceListeners) {

      if (this.sourceListeners.hasOwnProperty(key)) {
         this.sourceListeners[key].refreshSource();
      }
   }
};

PeerGang.prototype.addPeerGangCasa = function(_peerGangCasa) {
   this.peerGangCasas[_peerGangCasa.name] = _peerGangCasa;

   _peerGangCasa.on("disconnect", PeerGang.prototype.peerGangCasaUnavailableCb.bind(this, _peerGangCasa));
   _peerGangCasa.on("error", PeerGang.prototype.peerGangCasaUnavailableCb.bind(this, _peerGangCasa));
   _peerGangCasa.on("login-rejected", PeerGang.prototype.peerGangCasaLoginRejectedCb.bind(this, _peerGangCasa));
};

PeerGang.prototype.removePeerGangCasa = function(_peerGangCasa) {
   delete this.peerGangCasas[_peerGangCasa.name];
};

PeerGang.prototype.peerGangCasaUnavailableCb = function(_peerGangCasa, _data) {

   if (!this.peerGangCasas[_peerGangCasa.name]) {
      return;
   }

   var affectedSources = this.clearSourceOwnersForPeerGangCasa(_peerGangCasa);

   this.invalidateSources(affectedSources);
   this.disconnectPeerGangCasaIfRequested(_peerGangCasa, _data);
   this.removePeerGangCasa(_peerGangCasa);
   this.rediscoverSourceListenersForSources(affectedSources);
};

PeerGang.prototype.peerGangCasaLoginRejectedCb = function(_peerGangCasa, _data) {

   if (this.loginRejectAllowsRediscovery(_data)) {
      this.peerGangCasaUnavailableCb(_peerGangCasa, _data);
      return;
   }

   if (!this.peerGangCasas[_peerGangCasa.name]) {
      return;
   }

   var affectedSources = this.clearSourceOwnersForPeerGangCasa(_peerGangCasa);

   this.invalidateSources(affectedSources);
   this.removePeerGangCasa(_peerGangCasa);
};

PeerGang.prototype.loginRejectAllowsRediscovery = function(_data) {
   var reason = _data && _data.reason;

   return (reason !== "wrong-gang") && (reason !== "unauthorized") && (reason !== "forbidden");
};

PeerGang.prototype.disconnectPeerGangCasaIfRequested = function(_peerGangCasa, _data) {

   if (_data && _data.disconnectPeerGangCasa && (typeof _peerGangCasa.disconnect === "function")) {
      _peerGangCasa.disconnect(_data);
   }
};

PeerGang.prototype.clearSourceOwnersForPeerGangCasa = function(_peerGangCasa) {
   var affectedSources = {};

   for (var sourceName in this.sourceOwners) {

      if (this.sourceOwners.hasOwnProperty(sourceName) && (this.sourceOwners[sourceName] === _peerGangCasa.name)) {
         affectedSources[sourceName] = true;
         delete this.sourceOwners[sourceName];
      }
   }

   if (this.activePeerGangCasaName === _peerGangCasa.name) {
      this.activePeerGangCasaName = null;
   }

   return affectedSources;
};

PeerGang.prototype.invalidateSources = function(_sourceNames) {

   for (var sourceName in _sourceNames) {

      if (_sourceNames.hasOwnProperty(sourceName)) {
         this.sourceInvalid({ sourceName: sourceName });
      }
   }
};

PeerGang.prototype.rediscoverSourceListenersForSources = function(_sourceNames) {

   for (var key in this.sourceListeners) {

      if (this.sourceListeners.hasOwnProperty(key) && _sourceNames[this.sourceListeners[key].sourceName]) {
         this.discoverSourceOwnerForSourceListener(this.sourceListeners[key]);
      }
   }
};

PeerGang.prototype.findPeerGangCasa = function(_casaName) {
   return this.peerGangCasas[_casaName];
};

PeerGang.prototype.resubscribeSourceListeners = function(_peerGangCasa) {

   for (var key in this.sourceListeners) {

      if (this.sourceListeners.hasOwnProperty(key) &&
          this.sourceListenerOwnedByPeerGangCasa(this.sourceListeners[key], _peerGangCasa)) {
         this.sendSubscriptionForSourceListener(this.sourceListeners[key], "subscribeSource", _peerGangCasa);
      }
   }
};

PeerGang.prototype.sourceListenerOwnedByPeerGangCasa = function(_sourceListener, _peerGangCasa) {
   return _peerGangCasa && (this.sourceOwners[_sourceListener.sourceName] === _peerGangCasa.name);
};

PeerGang.prototype.selectPeerGangCasa = function() {

   if (this.activePeerGangCasaName && this.peerGangCasas[this.activePeerGangCasaName] && this.peerGangCasas[this.activePeerGangCasaName].connected) {
      return this.peerGangCasas[this.activePeerGangCasaName];
   }

   for (var casaName in this.peerGangCasas) {

      if (this.peerGangCasas.hasOwnProperty(casaName) && this.peerGangCasas[casaName].connected) {
         this.activePeerGangCasaName = casaName;
         return this.peerGangCasas[casaName];
      }
   }

   return null;
};

PeerGang.prototype.findOrCreateSource = function(_sourceName) {
   var source = this.sources[_sourceName];

   if (!source) {
      source = this.create(_sourceName, true, true, PeerGang.prototype.createSourceTreeNode.bind(this), { sourceName: _sourceName });
      this.addSource(source);
   }

   return source;
};

PeerGang.prototype.createSourceTreeNode = function(_uName, _owner, _params) {
   var name = (typeof _uName === "string" && _uName.startsWith(":")) ? _uName.split(":").pop() : _uName;

   if (_params && (_uName === _params.sourceName)) {
      return new PeerGangSource({ name: name, gang: this.localGang }, _owner);
   }

   return new NamedObject({ name: name, type: "namedobject", transient: true }, _owner);
};

PeerGang.prototype.addSource = function(_source) {
   this.sources[_source.uName] = _source;
};

PeerGang.prototype.removeSource = function(_source) {
   delete this.sources[_source.uName];
};

PeerGang.prototype.findNamedObject = function(_uName) {
   return this.sources[_uName] || NamedObject.prototype.findNamedObject.call(this, _uName);
};

PeerGang.prototype.sourcePropertyChanged = function(_data) {
   var source = this.findOrCreateSource(_data.sourceName);
   source.sourceHasChangedProperty(_data);
   this.refreshSourceListeners();
};

PeerGang.prototype.sourceEventRaised = function(_data) {
   var source = this.findOrCreateSource(_data.sourceName);
   source.sourceHasRaisedEvent(_data);
   this.refreshSourceListeners();
};

PeerGang.prototype.sourceInvalid = function(_data) {
   var source = this.findNamedObject(_data.sourceName);

   if (source) {
      source.invalidate(false);
   }
};

PeerGang.prototype.subscribeSourceListener = function(_sourceListener) {
   this.sourceListeners[this.listenerKey(_sourceListener)] = _sourceListener;
   this.sendSubscriptionForSourceListener(_sourceListener, "subscribeSource");
   return this.findNamedObject(_sourceListener.sourceName);
};

PeerGang.prototype.unsubscribeSourceListener = function(_sourceListener) {
   this.sendSubscriptionForSourceListener(_sourceListener, "unsubscribeSource");
   delete this.sourceListeners[this.listenerKey(_sourceListener)];
};

PeerGang.prototype.sendSubscriptionForSourceListener = function(_sourceListener, _method, _peerGangCasa) {
   var peerGangCasa = _peerGangCasa || this.selectPeerGangCasaForSourceListener(_sourceListener);

   if (peerGangCasa && (typeof peerGangCasa[_method] === "function")) {
      peerGangCasa[_method](_sourceListener.sourceName, {
         property: _sourceListener.listeningToPropertyChange ? _sourceListener.eventName : undefined,
         event: !_sourceListener.listeningToPropertyChange ? _sourceListener.eventName : undefined,
         subscription: _sourceListener.subscription
      });
   }
   else if (!_peerGangCasa && (_method === "subscribeSource")) {
      this.discoverSourceOwnerForSourceListener(_sourceListener);
   }
};

PeerGang.prototype.selectPeerGangCasaForSourceListener = function(_sourceListener) {
   var ownerCasaName = this.sourceOwners[_sourceListener.sourceName];

   if (ownerCasaName && this.peerGangCasas[ownerCasaName] && this.peerGangCasas[ownerCasaName].connected) {
      return this.peerGangCasas[ownerCasaName];
   }

   return null;
};

PeerGang.prototype.findCasaDiscoveryService = function() {

   if (!this.localGang || !this.localGang.casa || (typeof this.localGang.casa.findServiceName !== "function")) {
      return null;
   }

   var serviceName = this.localGang.casa.findServiceName("casadiscoveryservice");
   return serviceName && (typeof this.localGang.casa.findService === "function") ? this.localGang.casa.findService(serviceName) : null;
};

PeerGang.prototype.ensureCasaDiscoveryServiceListeners = function(_casaDiscoveryService) {

   if (this.casaDiscoveryServiceListenersSetUp || !_casaDiscoveryService ||
       (typeof _casaDiscoveryService.on !== "function")) {
      return;
   }

   _casaDiscoveryService.on("gang-casa-up", PeerGang.prototype.gangCasaUpCb.bind(this));
   _casaDiscoveryService.on("gang-casa-down", PeerGang.prototype.gangCasaDownCb.bind(this));
   this.casaDiscoveryServiceListenersSetUp = true;
};

PeerGang.prototype.gangCasaUpCb = function(_data) {

   if (!_data || (_data.gang !== this.gangName)) {
      return;
   }

   this.retrySourceOwnerDiscovery();
};

PeerGang.prototype.gangCasaDownCb = function(_data) {

   if (!_data || (_data.gang !== this.gangName) || !_data.casaName) {
      return;
   }

   var peerGangCasa = this.findPeerGangCasa(_data.casaName);

   if (peerGangCasa) {
      _data.disconnectPeerGangCasa = true;
      this.peerGangCasaUnavailableCb(peerGangCasa, _data);
   }
};

PeerGang.prototype.retrySourceOwnerDiscovery = function() {

   for (var key in this.sourceOwnerRetryRequired) {

      if (this.sourceOwnerRetryRequired.hasOwnProperty(key) && this.sourceOwnerRetryRequired[key] &&
          this.sourceListeners.hasOwnProperty(key)) {
         delete this.sourceOwnerRetryRequired[key];
         this.discoverSourceOwnerForSourceListener(this.sourceListeners[key]);
      }
   }
};

PeerGang.prototype.discoverSourceOwnerForSourceListener = function(_sourceListener) {
   var key = this.listenerKey(_sourceListener);

   if (this.sourceOwnerRequests[key]) {
      return;
   }

   var casaDiscoveryService = this.findCasaDiscoveryService();

   if (!casaDiscoveryService || (typeof casaDiscoveryService.discoverSourceOwner !== "function")) {
      return;
   }

   this.ensureCasaDiscoveryServiceListeners(casaDiscoveryService);
   this.sourceOwnerRequests[key] = true;
   casaDiscoveryService.discoverSourceOwner({
      gang: this.gangName,
      uName: _sourceListener.sourceName,
      property: _sourceListener.listeningToPropertyChange ? _sourceListener.eventName : undefined,
      event: !_sourceListener.listeningToPropertyChange ? _sourceListener.eventName : undefined
   }, (_err, _data) => {
      delete this.sourceOwnerRequests[key];

      if (_err) {
         this.sourceOwnerRetryRequired[key] = true;
         console.error(this.uName + ": Unable to discover source owner for " + _sourceListener.sourceName + ", error=" + _err.message);
         return;
      }

      delete this.sourceOwnerRetryRequired[key];
      this.sourceOwnerDiscovered(_sourceListener, _data);
   });
};

PeerGang.prototype.sourceOwnerDiscovered = function(_sourceListener, _data) {

   if (!_data || !_data.casaName || !_data.address || !_data.messageTransportName) {
      return;
   }

   this.sourceOwners[_sourceListener.sourceName] = _data.casaName;

   var peerGangCasa = this.findPeerGangCasa(_data.casaName);

   if (!peerGangCasa) {
      var PeerGangCasa = require('./peergangcasa');
      peerGangCasa = new PeerGangCasa({
         name: _data.casaName,
         gang: this.gangName,
         address: _data.address,
         messageTransport: _data.messageTransportName,
         localGang: this.localGang,
         localCasa: this.localGang ? this.localGang.casa : null
      }, this);
   }

   if (peerGangCasa.connected) {
      this.sendSubscriptionForSourceListener(_sourceListener, "subscribeSource", peerGangCasa);
   }
   else if ((typeof peerGangCasa.connect === "function") &&
            ((typeof peerGangCasa.isConnecting !== "function") || !peerGangCasa.isConnecting())) {
      peerGangCasa.connect({
         address: _data.address,
         messageTransport: _data.messageTransportName
      });
   }
};

PeerGang.prototype.setSourceProperty = function(_source, _propName, _propValue, _data) {
   var peerGangCasa = this.selectPeerGangCasa();
   return peerGangCasa ? peerGangCasa.setSourceProperty(_source, _propName, _propValue, _data) : false;
};

PeerGang.prototype.setSourcePropertyWithRamp = function(_source, _propName, _ramp, _data) {
   var peerGangCasa = this.selectPeerGangCasa();
   return peerGangCasa ? peerGangCasa.setSourcePropertyWithRamp(_source, _propName, _ramp, _data) : false;
};

PeerGang.prototype.raiseSourceEvent = function(_source, _eventName, _data) {
   var peerGangCasa = this.selectPeerGangCasa();
   return peerGangCasa ? peerGangCasa.raiseSourceEvent(_source, _eventName, _data) : false;
};

module.exports = exports = PeerGang;
