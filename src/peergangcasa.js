var util = require('./util');
var AsyncEmitter = require('./asyncemitter');
var Gang = require('./gang');
var PeerSocketSession = require('./peersocketsession');
var PeerSourceCommandProtocol = require('./peersourcecommandprotocol');
var PeerSourceSubscriptionProtocol = require('./peersourcesubscriptionprotocol');

function PeerGangCasa(_config, _owner) {
   AsyncEmitter.call(this);

   this.owner = _owner;
   this.peerGang = (_owner && (typeof _owner.superType === "function") && (_owner.superType() === "peergang")) ? _owner : null;
   this.gang = _config.localGang || Gang.mainInstance();
   this.casa = _config.localCasa || (this.gang ? this.gang.casa : null);
   this.name = _config.name || _config.casaName || "anonymous-" + Date.now();
   this.remoteGangName = _config.gang || (this.peerGang ? this.peerGang.gangName : null);
   this.address = _config.address;
   this.messageTransport = _config.messageTransport;
   this.secureMode = this.casa ? this.casa.secureMode : false;
   this.connected = false;
   this.state = "idle";
   this.serverRole = false;
   this.allowWrites = _config.hasOwnProperty("allowWrites") ? _config.allowWrites : false;
   this.localSubscriptions = {};
   this.incompleteRequests = {};

   this.session = new PeerSocketSession({ owner: this });

   if (this.peerGang) {
      this.peerGang.addPeerGangCasa(this);
   }
}

util.inherits(PeerGangCasa, AsyncEmitter);

PeerGangCasa.prototype.superType = function(_type) {
   return "peergangcasa";
};

PeerGangCasa.prototype.connect = function(_config) {

   if (_config) {
      this.address = _config.address || this.address;
      this.messageTransport = _config.messageTransport || this.messageTransport;
   }

   if (this.connected || this.isConnecting()) {
      return this.socket;
   }

   this.state = "connecting";
   this.socket = this.casa.mainWebService.newIoSocket(this.address, "/peergangcasa", this.secureMode, this.messageTransport);
   this.establishSocket(this.socket);
   return this.socket;
};

PeerGangCasa.prototype.serveClient = function(_socket) {
   this.serverRole = true;
   this.state = "connecting";
   this.establishSocket(_socket);
};

PeerGangCasa.prototype.isConnecting = function() {
   return this.state === "connecting";
};

PeerGangCasa.prototype.establishSocket = function(_socket) {
   this.socket = _socket;
   this.session.setSocket(_socket);
   this.sourceCommandProtocol = new PeerSourceCommandProtocol({
      owner: this,
      socket: this.socket,
      incompleteRequests: this.incompleteRequests,
      requestPrefix: this.name,
      requestor: this.casa ? this.casa.uName : null
   });
   this.sourceSubscriptionProtocol = new PeerSourceSubscriptionProtocol({
      owner: this,
      socket: this.socket
   });
   this.establishListeners();
};

PeerGangCasa.prototype.establishListeners = function() {
   this.session.addHandler("connect", PeerGangCasa.prototype.socketConnectCb.bind(this));
   this.session.addHandler("peer-gang-login", PeerGangCasa.prototype.socketPeerGangLoginCb.bind(this));
   this.session.addHandler("peer-gang-login-ack", PeerGangCasa.prototype.socketPeerGangLoginAckCb.bind(this));
   this.session.addHandler("peer-gang-login-reject", PeerGangCasa.prototype.socketPeerGangLoginRejectCb.bind(this));
   this.session.addHandler("subscribe-source", PeerGangCasa.prototype.socketSubscribeSourceCb.bind(this));
   this.session.addHandler("unsubscribe-source", PeerGangCasa.prototype.socketUnsubscribeSourceCb.bind(this));
   this.session.addHandler("source-property-changed", PeerGangCasa.prototype.socketSourcePropertyChangedCb.bind(this));
   this.session.addHandler("source-event-raised", PeerGangCasa.prototype.socketSourceEventRaisedCb.bind(this));
   this.session.addHandler("source-invalid", PeerGangCasa.prototype.socketSourceInvalidCb.bind(this));
   this.session.addHandler("set-source-property-resp", PeerGangCasa.prototype.socketSourceCommandRespCb.bind(this));
   this.session.addHandler("set-source-transaction-resp", PeerGangCasa.prototype.socketSourceCommandRespCb.bind(this));
   this.session.addHandler("raise-source-event-resp", PeerGangCasa.prototype.socketSourceCommandRespCb.bind(this));
   this.session.addHandler("heartbeat", PeerGangCasa.prototype.socketHeartbeatCb.bind(this));
   this.session.addHandler("disconnect", PeerGangCasa.prototype.socketDisconnectCb.bind(this));
   this.session.addHandler("error", PeerGangCasa.prototype.socketErrorCb.bind(this));
   this.session.addHandler("connect_error", PeerGangCasa.prototype.socketErrorCb.bind(this));
   this.session.establishListeners();
};

PeerGangCasa.prototype.socketConnectCb = function() {
   this.sendMessage("peer-gang-login", {
      casaName: this.casa.uName,
      gangName: this.gang.name,
      targetGang: this.remoteGangName
   });
};

PeerGangCasa.prototype.socketPeerGangLoginCb = function(_data) {
   var data = _data || {};
   var targetGang = data.targetGang;

   if (targetGang && (targetGang !== this.gang.name)) {
      this.sendMessage("peer-gang-login-reject", { reason: "wrong-gang", gangName: this.gang.name });
      return;
   }

   this.remoteCasaName = data.casaName;
   this.remoteGangName = data.gangName;
   this.connected = true;
   this.state = "connected";
   this.session.connected = true;
   this.sendMessage("peer-gang-login-ack", { casaName: this.casa.uName, gangName: this.gang.name });
   this.establishHeartbeat();
};

PeerGangCasa.prototype.socketPeerGangLoginAckCb = function(_data) {
   var data = _data || {};

   this.remoteCasaName = data.casaName;
   this.remoteGangName = data.gangName;
   this.connected = true;
   this.state = "connected";
   this.session.connected = true;
   this.establishHeartbeat();

   if (this.peerGang) {
      this.peerGang.resubscribeSourceListeners(this);
   }
};

PeerGangCasa.prototype.socketPeerGangLoginRejectCb = function(_data) {
   this.connected = false;
   this.state = "rejected";
   this.session.connected = false;
   this.session.stopHeartbeat();
   this.asyncEmit("login-rejected", _data);
};

PeerGangCasa.prototype.establishHeartbeat = function() {
   this.session.establishHeartbeat(
      () => { return { casaName: this.casa.uName, gangName: this.gang.name }; },
      () => { this.socketErrorCb({ error: "heartbeat-lost" }); }
   );
};

PeerGangCasa.prototype.socketHeartbeatCb = function(_data) {
   this.session.receivedHeartbeat();
};

PeerGangCasa.prototype.socketDisconnectCb = function(_data) {
   this.connected = false;
   this.state = "unavailable";
   this.session.connected = false;
   this.session.stopHeartbeat();
   this.removeLocalSubscriptions();
   this.asyncEmit("disconnect", _data);
};

PeerGangCasa.prototype.socketErrorCb = function(_data) {
   this.connected = false;
   this.state = "unavailable";
   this.session.connected = false;
   this.session.stopHeartbeat();
   this.removeLocalSubscriptions();
   this.asyncEmit("error", _data);
};

PeerGangCasa.prototype.disconnect = function(_data) {
   this.connected = false;
   this.state = "unavailable";
   this.session.connected = false;
   this.session.stopHeartbeat();
   this.removeLocalSubscriptions();

   if (this.socket && (typeof this.socket.disconnect === "function")) {
      this.socket.disconnect();
   }
};

PeerGangCasa.prototype.sendMessage = function(_message, _data) {
   this.session.sendMessage(_message, _data);
};

PeerGangCasa.prototype.subscribeSource = function(_sourceName, _config) {
   this.sourceSubscriptionProtocol.subscribeSource(_sourceName, _config);
};

PeerGangCasa.prototype.unsubscribeSource = function(_sourceName, _config) {
   this.sourceSubscriptionProtocol.unsubscribeSource(_sourceName, _config);
};

PeerGangCasa.prototype.socketSubscribeSourceCb = function(_data) {

   if (!this.validSourceSubscriptionData(_data)) {
      return;
   }

   var source = this.gang.findNamedObject(_data.sourceName);

   if (!source) {
      this.sourceSubscriptionProtocol.publishSourceInvalid({ sourceName: _data.sourceName, name: _data.property || _data.event });
      return;
   }

   if (_data.property) {
      this.addLocalPropertySubscription(source, _data);
   }
   else if (_data.event) {
      this.addLocalEventSubscription(source, _data);
   }
};

PeerGangCasa.prototype.socketUnsubscribeSourceCb = function(_data) {

   if (!this.validSourceSubscriptionData(_data)) {
      return;
   }

   this.removeLocalSubscription(this.localSubscriptionKey(_data));
};

PeerGangCasa.prototype.validSourceSubscriptionData = function(_data) {
   return _data && _data.sourceName &&
          ((_data.property && !_data.event) || (!_data.property && _data.event));
};

PeerGangCasa.prototype.addLocalPropertySubscription = function(_source, _data) {
   var key = this.localSubscriptionKey(_data);
   var subscription = _data.subscription || {};

   if (this.localSubscriptions[key]) {
      this.localSubscriptions[key].refCount = this.localSubscriptions[key].refCount + 1;
      return;
   }

   var handler = (_eventData) => {

      if (_eventData.name === _data.property) {
         this.sourceSubscriptionProtocol.publishSourcePropertyChanged(_eventData);
      }
   };

   _source.on("property-changed", handler, subscription);
   this.localSubscriptions[key] = { source: _source, event: "property-changed", handler: handler, subscription: subscription, refCount: 1 };

   if (_source.hasProperty(_data.property)) {
      this.sourceSubscriptionProtocol.publishSourcePropertyChanged({
         sourceName: _source.uName,
         name: _data.property,
         value: _source.getProperty(_data.property),
         valueType: _source.properties[_data.property].getValueType(),
         coldStart: true
      });
   }
};

PeerGangCasa.prototype.addLocalEventSubscription = function(_source, _data) {
   var key = this.localSubscriptionKey(_data);
   var subscription = _data.subscription || {};

   if (this.localSubscriptions[key]) {
      this.localSubscriptions[key].refCount = this.localSubscriptions[key].refCount + 1;
      return;
   }

   var handler = (_eventData) => {

      if (_eventData.name === _data.event) {
         this.sourceSubscriptionProtocol.publishSourceEventRaised(_eventData);
      }
   };

   _source.on("event-raised", handler, subscription);
   this.localSubscriptions[key] = { source: _source, event: "event-raised", handler: handler, subscription: subscription, refCount: 1 };
};

PeerGangCasa.prototype.localSubscriptionKey = function(_data) {
   return [_data.sourceName, _data.property ? "property" : "event", _data.property || _data.event].join(":");
};

PeerGangCasa.prototype.removeLocalSubscriptions = function() {

   for (var key in this.localSubscriptions) {

      if (this.localSubscriptions.hasOwnProperty(key)) {
         this.removeLocalSubscription(key, true);
      }
   }
};

PeerGangCasa.prototype.removeLocalSubscription = function(_key, _force) {
   var subscription = this.localSubscriptions[_key];

   if (subscription) {
      subscription.refCount = _force ? 0 : subscription.refCount - 1;

      if (subscription.refCount > 0) {
         return;
      }

      subscription.source.removeListener(subscription.event, subscription.handler, subscription.subscription);
      delete this.localSubscriptions[_key];
   }
};

PeerGangCasa.prototype.socketSourcePropertyChangedCb = function(_data) {

   if (this.peerGang) {
      this.peerGang.sourcePropertyChanged(_data);
   }
};

PeerGangCasa.prototype.socketSourceEventRaisedCb = function(_data) {

   if (this.peerGang) {
      this.peerGang.sourceEventRaised(_data);
   }
};

PeerGangCasa.prototype.socketSourceInvalidCb = function(_data) {

   if (this.peerGang) {
      this.peerGang.sourceInvalid(_data);
   }
};

PeerGangCasa.prototype.socketSourceCommandRespCb = function(_data) {
   return this.sourceCommandProtocol.completeResponse(_data);
};

PeerGangCasa.prototype.setSourceProperty = function(_source, _propName, _propValue, _data) {
   return this.allowWrites && this.connected ? this.sourceCommandProtocol.sendSetSourceProperty(_source, _propName, _propValue, _data) : false;
};

PeerGangCasa.prototype.setSourcePropertyWithRamp = function(_source, _propName, _ramp, _data) {
   return this.allowWrites && this.connected ? this.sourceCommandProtocol.sendSetSourcePropertyWithRamp(_source, _propName, _ramp, _data) : false;
};

PeerGangCasa.prototype.raiseSourceEvent = function(_source, _eventName, _data) {
   return this.allowWrites && this.connected ? this.sourceCommandProtocol.sendRaiseSourceEvent(_source, _eventName, _data) : false;
};

module.exports = exports = PeerGangCasa;
