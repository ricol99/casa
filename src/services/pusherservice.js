var util = require('util');
var Service = require('../service');
var Pusher = require("pusher-js");
var PusherServer = require("pusher");
var AsyncEmitter = require('../asyncemitter');

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

PusherService.prototype.goingDown = function(_err) {
   this.sendMessage("control-channel", "status-update", { casaName: this.gang.casa.name, status: "down" });
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
      this.pusherServer.trigger(_channel, _message, _body);
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
      node.processSubscription({ subscriber: _data.uName, sync: "write", serviceProperty: _data.propName, subscriberProperty: _data.propName, args: { subscriptionUName: _data.uName, sourceName: _data.sourceName} });
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

   var messageChannel = this.pusher.subscribe("message-channel_" + this.owner.gang.casa.uName.replace(/:/g, ""));

   messageChannel.bind("message", (_data) => {
      console.log(this.owner.uName + ": Message received from " + _data.peerAddress + ", message=",_data.message);

      if (_data && _data.hasOwnProperty("peerAddress") && (_data.peerAddress !== this.owner.gang.casa.uName) &&
          _data.hasOwnProperty("route") && _data.hasOwnProperty("id") &&
          _data.hasOwnProperty("destAddress") && _data.hasOwnProperty("message") &&  _data.hasOwnProperty("messageData")) { 

          this.asyncEmit(_data.message, _data);
      }
      else {
         console.error(this.uName + ": Receive malformed message on message channel");
      }
   }, this);
};

PusherMessageTransport.prototype.sendMessage = function(_message, _data) {
   _data.message = _message;
   this.owner.sendMessage("message-channel_" + _data.peerAddress.replace(/:/g, ""), "message", _data);
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
      console.log(this.owner.uName + ":" + this.name + ": Status update requested: name: " + _data.casaName);
         
      if (_data && _data.hasOwnProperty("casaName") && (_data.casaName !== this.owner.gang.casa.name)) {

         if (_data.hasOwnProperty("status")) {

            if (this.searching) {
               this.casaDiscoveryService.casaStatusUpdate(_data.casaName, _data.status, _data.casaName, this.name, this.messageTransportName, this.tier);
            }
         }
   
         if (this.broadcasting && ((_data.hasOwnProperty("status") && (_data.status === "up")) || !_data.hasOwnProperty("status"))) {
            this.owner.sendMessage("control-channel", "status-update", { casaName: this.owner.gang.casa.name, status: "up" });
         }
      }
   }, this);
   
   this.controlChannel.bind("status-update", (_data) => {
      console.log(this.owner.uName + ":" + this.name + ": Status update received/requested: name: " + _data.casaName);

      if (_data && _data.hasOwnProperty("status") && _data.hasOwnProperty("casaName") && (_data.casaName !== this.owner.gang.casa.name)) {

         if (this.searching) {
            this.casaDiscoveryService.casaStatusUpdate(_data.casaName, _data.status, _data.casaName, this.name, this.messageTransportName, this.tier);
         }
      }
   }, this);
};

PusherDiscoveryTransport.prototype.startSearching = function() {
   this.owner.sendMessage("control-channel", "status-request",  { casaName: this.owner.gang.casa.name });
   this.searching = true;
};

PusherDiscoveryTransport.prototype.stopSearching = function() {
   this.searching = false;
};

PusherDiscoveryTransport.prototype.startBroadcasting = function() {
   this.owner.sendMessage("control-channel", "status-request",  { casaName: this.owner.gang.casa.name, status: "up" });
   this.broadcasting = true;
};

PusherDiscoveryTransport.prototype.stopBroadcasting = function() {
   this.owner.sendMessage("control-channel", "status-update", { casaName: this.owner.gang.casa.name, status: "down" });
   this.broadcasting = false;
};

module.exports = exports = PusherService;
