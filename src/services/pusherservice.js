var util = require('util');
var Service = require('../service');
var Pusher = require("pusher-js");
var PusherServer = require("pusher");
var AsyncEmitter = require('../asyncemitter');
var GangCasaAddress = require('../gangcasaaddress');

function PusherService(_config, _owner) {
   Service.call(this, _config, _owner);

   this.deviceTypes = {
      "source": "pushersource",
      "subscription": "pushersubscription"
   };

   this.appId = _config.appId;
   this.appKey = _config.appKey;
   this.appSecret = _config.appSecret;
   this.appCluster = _config.appCluster;

   this.subscribers = {};
   this.routes = {};
}

util.inherits(PusherService, Service);

// Called when current state required
PusherService.prototype.export = function(_exportObj) {
   Service.prototype.export.call(this, _exportObj);
};

// Called when current state required
PusherService.prototype.import = function(_importObj) {
   Service.prototype.import.call(this, _importObj);
};

PusherService.prototype.coldStart = function() {
   this.start();
   Service.prototype.coldStart.call(this);
};

PusherService.prototype.hotStart = function() {
   this.start();
   Service.prototype.hotStart.call(this);
};

PusherService.prototype.start = function() {

   try {
      this.pusher = new Pusher(this.appKey, { cluster: this.appCluster });

      var channel = this.pusher.subscribe("control-channel");

      channel.bind("subscription-request", (_data) => {
         console.log(this.uName + ": Subscription requested: uName: " + _data.uName);

         if (_data && _data.hasOwnProperty("uName") && _data.hasOwnProperty("sourceName") && (_data.sourceName !== this.gang.casa.uName) && _data.hasOwnProperty("propName")) { 
            var source = this.gang.findNamedObject(_data.uName);

             if (source && (source.casa === this.gang.casa) && source.hasProperty(_data.propName)) {

                if (this.subscribers.hasOwnProperty(_data.sourceName)) {
                   this.subscribers[_data.sourceName].addSubscription(_data);
                }
                else {
                   this.subscribers[_data.sourceName] = new Subscriber(_data, this);
                }
             }
         }
      }, this);

      var ioMessagesocketServiceName = this.gang.casa.findServiceName("iomessagesocketservice");
      this.ioMessageSocketService = ioMessagesocketServiceName ? this.gang.casa.findService(ioMessagesocketServiceName) : null;

      if (this.ioMessageSocketService) {
         this.pusherMessageTransport = new PusherMessageTransport(this, this.ioMessageSocketService);
         this.pusherMessageTransport.start(this.pusher);
      }

      var casaDiscoveryServiceName = this.gang.casa.findServiceName("casadiscoveryservice");
      this.casaDiscoveryService = casaDiscoveryServiceName ? this.gang.casa.findService(casaDiscoveryServiceName) : null;

      if (this.casaDiscoveryService) {
         this.pusherDiscoveryTransport = new PusherDiscoveryTransport(this, "pusher", this.casaDiscoveryService, "pusher", 2);
         this.pusherDiscoveryTransport.start(this.pusher, channel);
      }

      this.pusherServer = new PusherServer({ appId: this.appId, key: this.appKey,
                                             secret: this.appSecret, cluster: this.appCluster, useTLS: true });

   }
   catch (_error) {
      console.error(this.uName + ": Unable to establish Pusher session, appId = " + this.appId + ", error = ", _error);
   }
};

PusherService.prototype.sendMessage = function(_channel, _message, _body) {

   try {
      this.pusherServer.trigger(_channel, _message, _body).catch( (_error) => {
         console.error(this.uName + ": Unable to send message to pusher channel "+ _channel);
      });
   }
   catch (_error) {
      console.error(this.uName + ": Unable to publish message on channel "+_channel +", error="+_error);
   }
};

function Subscriber(_data, _owner) {
   this.owner = _owner;
   this.sourceName = _data.sourceName;
   this.subscriptions = {};
   this.noOfSubscriptions = 0;

   this.addSubscription(_data);
}

Subscriber.prototype.addSubscription = function(_data) {

   if (this.subscriptions.hasOwnProperty(_data.uName+":"+_data.propName)) {
      clearTimeout(this.subscriptions[_data.uName+":"+_data.propName].timeout);
      this.subscriptions[_data.uName+":"+_data.propName].timeout = setTimeout( (_uName, _property) => { this.removeSubscription(_uName, _property); }, 24*3600000, _data.uName, _data.propName);
   }
   else {
      var node = this.owner.findOrCreateNode("subscription", _data.uName.replace(/:/g, "_")/*, { subscriber: _data.uName, sync: "write", serviceProperty: _data.propName, args: { subscriptionUName: _data.uName, sourceName: _data.sourceName } }*/);

      this.subscriptions[_data.uName+":"+_data.propName] = { node: node, uName: _data.uName, property: _data.propName,
                                                             timeout: setTimeout( (_uName, property) => { this.removeSubscription(_uName, _property); }, 24*3600000, _data.uName, _data.propName) };
      this.noOfSubscriptions = this.noOfSubscriptions + 1;
      node.processSubscription({ subscriber: _data.uName, sync: "write", serviceProperty: _data.propName, subscriberProperty: _data.propName, valueType: _data.valueType, args: { subscriptionUName: _data.uName, sourceName: _data.sourceName} });
   }
};

Subscriber.prototype.removeSubscription = function(_uName, _property) {
   this.subscriptions[_uName+":"+_property].node.removePusherSubscription(this.sourceName, _property);
   delete this.subscriptions[_uName+":"+_property];
   this.noOfSubscriptions = this.noOfSubscriptions - 1;

   if (this.noOfSubscriptions === 0) {
      delete this.owner.subscribers[this.sourceName];
   }
};

function PusherMessageTransport(_owner, _ioMessageSocketService) {
   AsyncEmitter.call(this);
   this.owner = _owner;
   this.ioMessageSocketService = _ioMessageSocketService;
   this.pendingMessages = {};
   this.maxPayloadBytes = 5 * 1024;
   this.maxFragmentCount = 2048;
   this.pendingMessageTimeoutMs = 30000;
   this.nextFragmentId = 0;
   this.completedFragmentMessages = {};
   this.nextPusherMessageId = 0;
   this.receivedPusherMessages = {};
   this.receivedPusherMessageTimeoutMs = 60000;
   this.pusherOriginId = [
      this.owner.gang.name,
      this.owner.gang.casa.uName,
      Date.now(),
      Math.floor(Math.random() * 1000000000)
   ].join(":");
   this.subscribedChannels = {};
}

util.inherits(PusherMessageTransport, AsyncEmitter);

PusherMessageTransport.prototype.start = function(_pusher) {
   this.pusher = _pusher;

   if (this.ioMessageSocketService) {
      this.ioMessageSocketService.addMessageTransport("pusher", this);

      var consoleApiServiceName = this.owner.gang.casa.findServiceName("consoleapiservice");
      this.consoleApiService = consoleApiServiceName ? this.owner.gang.casa.findService(consoleApiServiceName) : null;

      if (this.consoleApiService) {
         this.consoleApiService.addIoTransport("pusher");
      }
   }

   var channelNames = this.messageChannelNames(this.localPeerAddress());

   for (var i = 0; i < channelNames.length; ++i) {
      this.subscribeMessageChannel(channelNames[i]);
   }
};

PusherMessageTransport.prototype.subscribeMessageChannel = function(_channelName) {

   if (this.subscribedChannels[_channelName + ":message"]) {
      return;
   }

   this.subscribedChannels[_channelName + ":message"] = true;

   var messageChannel = this.pusher.subscribe(_channelName);

   messageChannel.bind("message", (_data) => {
      this.receivedPusherTransportMessage(_data);
   }, this);
};

PusherMessageTransport.prototype.receivedPusherTransportMessage = function(_data) {
   _data = this.processIncomingMessage(_data);

   if (!_data) {
      return;
   }

   if (_data.pusherOriginId && (_data.pusherOriginId === this.pusherOriginId)) {
      return;
   }

   if (this.hasSeenPusherMessage(_data)) {
      return;
   }

   delete _data.pusherMessageId;
   delete _data.pusherOriginId;

   console.log(this.owner.uName + ": Message received from " + _data.peerAddress + ", message=",_data.message);

   if (_data && _data.hasOwnProperty("peerAddress") &&
       _data.hasOwnProperty("route") && _data.hasOwnProperty("id") &&
       _data.hasOwnProperty("destAddress") && _data.hasOwnProperty("message") &&  _data.hasOwnProperty("messageData")) {

       this.asyncEmit(_data.message, _data);
   }
   else {
      console.error(this.uName + ": Receive malformed message on message channel");
   }
};

PusherMessageTransport.prototype.base64UrlEncode = function(_value) {
   return Buffer.from(_value, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

PusherMessageTransport.prototype.messageChannelName = function(_address) {
   return "message-channel_v2_" + this.base64UrlEncode(_address);
};

PusherMessageTransport.prototype.messageChannelNames = function(_address) {
   return [this.messageChannelName(_address)];
};

PusherMessageTransport.prototype.localPeerAddress = function() {
   return new GangCasaAddress({
      gang: this.owner.gang.name,
      casa: this.owner.gang.casa.uName
   }).toString();
};

PusherMessageTransport.prototype.createPusherMessageId = function(_data) {
   return [
      this.pusherOriginId,
      _data.destAddress,
      _data.id,
      Date.now(),
      this.nextPusherMessageId++
   ].join(":");
};

PusherMessageTransport.prototype.hasSeenPusherMessage = function(_data) {

   if (!_data.pusherMessageId) {
      return false;
   }

   if (this.receivedPusherMessages.hasOwnProperty(_data.pusherMessageId)) {
      return true;
   }

   this.receivedPusherMessages[_data.pusherMessageId] = setTimeout( (_pusherMessageId) => {
      delete this.receivedPusherMessages[_pusherMessageId];
   }, this.receivedPusherMessageTimeoutMs, _data.pusherMessageId);

   if (this.receivedPusherMessages[_data.pusherMessageId].unref) {
      this.receivedPusherMessages[_data.pusherMessageId].unref();
   }

   return false;
};

PusherMessageTransport.prototype.isFragmentEnvelope = function(_data) {
   return _data &&
          (_data.__casaPusherFragment === true) &&
          (typeof _data.fragmentId === "string") &&
          (typeof _data.fragmentIndex === "number") &&
          (typeof _data.fragmentCount === "number") &&
          (typeof _data.fragmentData === "string");
};

PusherMessageTransport.prototype.makeFragmentEnvelope = function(_fragmentId, _fragmentIndex, _fragmentCount, _fragmentData) {
   return {
      __casaPusherFragment: true,
      fragmentId: _fragmentId,
      fragmentIndex: _fragmentIndex,
      fragmentCount: _fragmentCount,
      fragmentData: _fragmentData
   };
};

PusherMessageTransport.prototype.serializedSize = function(_payload) {
   return Buffer.byteLength(JSON.stringify(_payload), "utf8");
};

PusherMessageTransport.prototype.clearPendingMessage = function(_fragmentId) {

   if (this.pendingMessages.hasOwnProperty(_fragmentId)) {
      clearTimeout(this.pendingMessages[_fragmentId].timeout);
      delete this.pendingMessages[_fragmentId];
   }
};

PusherMessageTransport.prototype.markCompletedFragmentMessage = function(_fragmentId) {
   this.completedFragmentMessages[_fragmentId] = setTimeout( (_completedFragmentId) => {
      delete this.completedFragmentMessages[_completedFragmentId];
   }, this.pendingMessageTimeoutMs, _fragmentId);

   if (this.completedFragmentMessages[_fragmentId].unref) {
      this.completedFragmentMessages[_fragmentId].unref();
   }
};

PusherMessageTransport.prototype.processIncomingMessage = function(_data) {

   if (!this.isFragmentEnvelope(_data)) {
      return _data;
   }

   if ((_data.fragmentCount < 1) ||
       (_data.fragmentCount > this.maxFragmentCount) ||
       (_data.fragmentIndex < 0) ||
       (_data.fragmentIndex >= _data.fragmentCount)) {
      console.error(this.owner.uName + ": Ignoring malformed fragmented pusher message");
      return null;
   }

   if (this.completedFragmentMessages.hasOwnProperty(_data.fragmentId)) {
      return null;
   }

   if (!this.pendingMessages.hasOwnProperty(_data.fragmentId)) {
      this.pendingMessages[_data.fragmentId] = {
         fragmentCount: _data.fragmentCount,
         fragments: new Array(_data.fragmentCount),
         received: {},
         receivedCount: 0,
         timeout: setTimeout( (_fragmentId) => {
            console.error(this.owner.uName + ": Timed out waiting for fragmented pusher message " + _fragmentId);
            this.clearPendingMessage(_fragmentId);
         }, this.pendingMessageTimeoutMs, _data.fragmentId)
      };

      if (this.pendingMessages[_data.fragmentId].timeout.unref) {
         this.pendingMessages[_data.fragmentId].timeout.unref();
      }
   }

   var pending = this.pendingMessages[_data.fragmentId];

   if (pending.fragmentCount !== _data.fragmentCount) {
      console.error(this.owner.uName + ": Ignoring inconsistent fragmented pusher message " + _data.fragmentId);
      this.clearPendingMessage(_data.fragmentId);
      return null;
   }

   pending.fragments[_data.fragmentIndex] = _data.fragmentData;

   if (!pending.received[_data.fragmentIndex]) {
      pending.received[_data.fragmentIndex] = true;
      pending.receivedCount = pending.receivedCount + 1;
   }

   if (pending.receivedCount < pending.fragmentCount) {
      return null;
   }

   var combined = pending.fragments.join("");
   this.clearPendingMessage(_data.fragmentId);
   this.markCompletedFragmentMessage(_data.fragmentId);

   try {
      return JSON.parse(combined);
   }
   catch (_error) {
      console.error(this.owner.uName + ": Unable to parse reconstructed fragmented pusher message", _error);
      return null;
   }
};

PusherMessageTransport.prototype.splitPayload = function(_serializedPayload, _fragmentId) {
   var fragments = [];
   var start = 0;

   while (start < _serializedPayload.length) {
      var low = start + 1;
      var high = _serializedPayload.length;
      var bestEnd = start;

      while (low <= high) {
         var mid = Math.floor((low + high) / 2);
         var candidate = _serializedPayload.slice(start, mid);
         var envelope = this.makeFragmentEnvelope(_fragmentId, fragments.length, this.maxFragmentCount, candidate);

         if (this.serializedSize(envelope) <= this.maxPayloadBytes) {
            bestEnd = mid;
            low = mid + 1;
         }
         else {
            high = mid - 1;
         }
      }

      if (bestEnd === start) {
         return null;
      }

      fragments.push(_serializedPayload.slice(start, bestEnd));

      if (fragments.length > this.maxFragmentCount) {
         return null;
      }

      start = bestEnd;
   }

   return fragments;
};

PusherMessageTransport.prototype.sendTransportMessageOnChannel = function(_channelName, _message, _data) {
   _data.message = _message;
   _data.pusherOriginId = this.pusherOriginId;
   _data.pusherMessageId = this.createPusherMessageId(_data);

   if (this.serializedSize(_data) <= this.maxPayloadBytes) {
      this.owner.sendMessage(_channelName, "message", _data);
      return;
   }

   var fragmentId = (_data.id ? _data.id : "fragment") + ":" + Date.now() + ":" + this.nextFragmentId++;
   var fragments = this.splitPayload(JSON.stringify(_data), fragmentId);

   if (!fragments) {
      console.error(this.owner.uName + ": Unable to split oversized pusher message " + fragmentId);
      return;
   }

   // Keep fragmentation hidden inside the bearer so higher-level socket code sees the original envelope.
   for (var i = 0; i < fragments.length; ++i) {
      this.owner.sendMessage(_channelName, "message", this.makeFragmentEnvelope(fragmentId, i, fragments.length, fragments[i]));
   }
};

PusherMessageTransport.prototype.sendMessage = function(_message, _data) {
   this.sendTransportMessageOnChannel(this.messageChannelName(_data.destAddress), _message, _data);
};

function PusherDiscoveryTransport(_owner, _name, _casaDiscoveryService, _messageTransportName, _tier) {
   AsyncEmitter.call(this);
   this.owner = _owner;
   this.name = _name;
   this.casaDiscoveryService = _casaDiscoveryService;
   this.messageTransportName = _messageTransportName;
   this.tier = _tier;
   this.searching = false;
   this.broadcasting = false;

   this.owner.casaDiscoveryService.addDiscoveryTransport(this.name, this);
}
            
util.inherits(PusherDiscoveryTransport, AsyncEmitter);

PusherDiscoveryTransport.prototype.start = function(_pusher, _controlChannel) {
   this.pusher = _pusher;
   this.controlChannel = _controlChannel;

   this.controlChannel.bind("status-request", (_data) => {
      if (!_data) {
         return;
      }

      console.log(this.owner.uName + ":" + this.name + ": Status update requested: name: " + _data.casaName);
      this.processGangCasaStatus(_data);

      if (_data.hasOwnProperty("gang") && (_data.gang !== this.owner.gang.name)) {
         return;
      }

      if (_data.hasOwnProperty("casaName") && (_data.casaName !== this.owner.gang.casa.name)) {

         if (_data.hasOwnProperty("status")) {

            if (this.searching) {
               this.casaDiscoveryService.casaStatusUpdate(_data.casaName, _data.status, _data.address, this.name, this.messageTransportName, this.tier);
            }
         }
   
         if (this.broadcasting && ((_data.hasOwnProperty("status") && (_data.status === "up")) || !_data.hasOwnProperty("status"))) {
            this.sendStatusUpdate("up");
         }
      }
   }, this);
   
   this.controlChannel.bind("status-update", (_data) => {
      if (!_data) {
         return;
      }

      console.log(this.owner.uName + ":" + this.name + ": Status update received/requested: name: " + _data.casaName);
      this.processGangCasaStatus(_data);

      if (_data.hasOwnProperty("gang") && (_data.gang !== this.owner.gang.name)) {
         return;
      }

      if (_data.hasOwnProperty("status") && _data.hasOwnProperty("casaName") && (_data.casaName !== this.owner.gang.casa.name)) {

         if (this.searching) {
            this.casaDiscoveryService.casaStatusUpdate(_data.casaName, _data.status, _data.address, this.name, this.messageTransportName, this.tier);
         }
      }
   }, this);

   this.controlChannel.bind("source-owner-request", (_data) => {
      this.sourceOwnerRequest(_data);
   }, this);

   this.controlChannel.bind("source-owner-response", (_data) => {
      this.sourceOwnerResponse(_data);
   }, this);
};

PusherDiscoveryTransport.prototype.localPeerAddress = function() {
   return new GangCasaAddress({
      gang: this.owner.gang.name,
      casa: this.owner.gang.casa.uName
   }).toString();
};

PusherDiscoveryTransport.prototype.sendStatusUpdate = function(_status) {
   this.owner.sendMessage("control-channel", "status-update", {
      gang: this.owner.gang.name,
      casaName: this.owner.gang.casa.name,
      address: this.localPeerAddress(),
      status: _status
   });
};

PusherDiscoveryTransport.prototype.processGangCasaStatus = function(_data) {

   if (!_data.hasOwnProperty("gang") || !_data.hasOwnProperty("status") ||
       !_data.hasOwnProperty("casaName") || !_data.hasOwnProperty("address")) {
      return;
   }

   if ((_data.gang === this.owner.gang.name) && (_data.casaName === this.owner.gang.casa.name)) {
      return;
   }

   this.casaDiscoveryService.gangCasaStatusUpdate(_data.gang, _data.casaName, _data.status, _data.address, this.name, this.messageTransportName, this.tier);
};

PusherDiscoveryTransport.prototype.discoverSourceOwner = function(_request) {
   this.owner.sendMessage("control-channel", "source-owner-request", {
      requestId: _request.requestId,
      gang: _request.gang,
      uName: _request.uName,
      property: _request.property,
      event: _request.event,
      requesterGang: this.owner.gang.name,
      requesterCasa: this.owner.gang.casa.uName
   });
};

PusherDiscoveryTransport.prototype.sourceOwnerRequest = function(_data) {

   if (!_data || (_data.requesterGang === this.owner.gang.name && _data.requesterCasa === this.owner.gang.casa.uName)) {
      return;
   }

   if (!this.casaDiscoveryService.canServeSourceOwnerRequest(_data)) {
      return;
   }

   this.owner.sendMessage("control-channel", "source-owner-response", {
      requestId: _data.requestId,
      gang: this.owner.gang.name,
      uName: _data.uName,
      property: _data.property,
      event: _data.event,
      casaName: this.owner.gang.casa.uName,
      address: this.localPeerAddress()
   });
};

PusherDiscoveryTransport.prototype.sourceOwnerResponse = function(_data) {

   if (!_data) {
      return;
   }

   this.casaDiscoveryService.sourceOwnerStatusUpdate(_data, this.name, this.messageTransportName, this.tier);
};

PusherDiscoveryTransport.prototype.goingDown = function(_err) {
   this.sendStatusUpdate("down");
};

PusherDiscoveryTransport.prototype.startSearching = function() {
   this.owner.sendMessage("control-channel", "status-request",  { gang: this.owner.gang.name, casaName: this.owner.gang.casa.name });
   this.searching = true;
};

PusherDiscoveryTransport.prototype.stopSearching = function() {
   this.searching = false;
};

PusherDiscoveryTransport.prototype.startBroadcasting = function() {
   this.owner.sendMessage("control-channel", "status-request",  {
      gang: this.owner.gang.name,
      casaName: this.owner.gang.casa.name,
      address: this.localPeerAddress(),
      status: "up"
   });
   this.broadcasting = true;
};

PusherDiscoveryTransport.prototype.stopBroadcasting = function() {
   this.sendStatusUpdate("down");
   this.broadcasting = false;
};

module.exports = exports = PusherService;
module.exports.__testExports = {
   PusherMessageTransport: PusherMessageTransport,
   PusherDiscoveryTransport: PusherDiscoveryTransport
};
