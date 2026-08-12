var util = require('util');
var Service = require('../service');
var AsyncEmitter = require('../asyncemitter');
var GangCasaAddress = require('../gangcasaaddress');
const WebSocket = require('ws');

function WhRelayService(_config, _owner) {
   _config.optimiseTransactions = false;  // Only allow one event and property per transaction
   _config.deviceTypes = { "source": "whrelaysource" };
   Service.call(this, _config, _owner);

   this.apiKey = _config.apiKey;
   this.apiSecret = _config.apiSecret;
   this.bucketName = _config.bucket;
   this.url = _config.url;
   this.whrelaySources = {};
   this.receivedWhRelayMessages = {};
   this.receivedWhRelayMessageTimeoutMs = _config.receivedWhRelayMessageTimeoutMs || 60000;
   this.nextWhRelayMessageId = 0;
   this.whrelayOriginId = [
      this.gang.name,
      this.gang.casa.uName,
      Date.now(),
      Math.floor(Math.random() * 1000000000)
   ].join(":");

   this.messageEventHandler = this.newMessageReceived.bind(this);
   this.openEventHandler = this.connected.bind(this);
   this.errorEventHandler = this.error.bind(this);
   this.heartbeat = new Heartbeat(this);
}

util.inherits(WhRelayService, Service);

// Called when current state required
WhRelayService.prototype.export = function(_exportObj) {
   Service.prototype.export.call(this, _exportObj);
};

// Called when current state required
WhRelayService.prototype.import = function(_importObj) {
   Service.prototype.import.call(this, _importObj);
};

WhRelayService.prototype.coldStart = function() {
   Service.prototype.coldStart.call(this);
   this.start();
};

WhRelayService.prototype.hotStart = function() {
   Service.prototype.hotStart.call(this);
   this.start();
};

WhRelayService.prototype.start = function() {

   try { 
        this.ws = new WebSocket('wss://my.webhookrelay.com/v1/socket');
        this.ws.on('open', this.openEventHandler);
        this.ws.on('message', this.messageEventHandler);
        this.ws.on('close', this.errorEventHandler);

        this.heartbeat.start();
        this.startTransports();
   }
   catch(_error) {
      console.error(this.uName + ": Unable to establish link to WhRelay service. Error: ", _error);

      setTimeout( () => {
         this.ws = null;
         this.heartbeat.stop();
         this.heartbeat = null;
         this.heartbeat = new Heartbeat(this);
         this.start();
      }, 60000);
   }
};

WhRelayService.prototype.startTransports = function() {
   var ioMessagesocketServiceName = this.gang.casa.findServiceName("iomessagesocketservice");
   this.ioMessageSocketService = ioMessagesocketServiceName ? this.gang.casa.findService(ioMessagesocketServiceName) : null;

   if (this.ioMessageSocketService && !this.whRelayMessageTransport) {
      this.whRelayMessageTransport = new WhRelayMessageTransport(this, this.ioMessageSocketService);
      this.whRelayMessageTransport.start();
   }

   var casaDiscoveryServiceName = this.gang.casa.findServiceName("casadiscoveryservice");
   this.casaDiscoveryService = casaDiscoveryServiceName ? this.gang.casa.findService(casaDiscoveryServiceName) : null;

   if (this.casaDiscoveryService && !this.whRelayDiscoveryTransport) {
      this.whRelayDiscoveryTransport = new WhRelayDiscoveryTransport(this, "whrelay", this.casaDiscoveryService, "whrelay", 3);
      this.whRelayDiscoveryTransport.start();
   }
};

WhRelayService.prototype.newMessageReceived = function(_data) {

   try {
      var msg = JSON.parse(_data);

      if (msg.hasOwnProperty("type")) {

         if (msg.type === "status") {

            if (msg.status === "authenticated") {
               // if we got authentication confirmation, send subscribe event to the server
               this.ws.send(JSON.stringify({action: 'subscribe', buckets: [ this.bucketName ]}));
            }
            else if (msg.status === "subscribed") {
               console.log(this.uName+": Subscribed to bucket "+this.bucketName);
               this.ready = true;
            }
            else if (msg.status === "ping") {
               this.heartbeat.heartbeatReceived();
            }
            else {
               console.log(this.uName + ": newMessageReceived() with status="+msg.status+" not recognised");
            }
         }
         else if ((msg.type === "webhook") && msg.hasOwnProperty("body")) {
            var jsonBody = JSON.parse(msg.body);

            if (jsonBody.hasOwnProperty("secret") && (jsonBody.secret === this.apiSecret)) {
               this.processWebhook(jsonBody);
            }
            else {
               console.error(this.uName + ": Error decoding webhook, body, secret or both missing");
            }
         }
      }
   }
   catch (_error) {
      console.error(this.uName + ": Error decoding message, err=" + _error);
   }
};

WhRelayService.prototype.processWebhook = function(_body) {

   console.log(this.uName+": newMessageReceived() request=", _body);

   if (this.processTransportWebhook(_body)) {
      return;
   }

   if (_body.hasOwnProperty("uName")) {
      console.log(this.uName+": newMessageReceived() valid message!");

      if (this.whrelaySources.hasOwnProperty(_body.uName)) {

         if (!(_body.hasOwnProperty("sourceCasa") && !this.whrelaySources[_body.uName].ignoreSourceCasa && (_body.sourceCasa === this.casa.uName))) {

            if (_body.hasOwnProperty("propName") && _body.hasOwnProperty("propValue")) {
               console.log(this.uName+": newMessageReceived() Forwarding property change message to node");
               this.whrelaySources[_body.uName].handler.newPropertyChangeReceived(_body);
            }
            else if (_body.hasOwnProperty("eventName")) {
               console.log(this.uName+": newMessageReceived() Forwarding event message to node");
               this.whrelaySources[_body.uName].handler.newEventReceived(_body);
            }
         }
      }
   }
   else {
      console.error(this.uName + ": Received corrupt message from WhRelay bucket " + this.bucketName);
   }
};

WhRelayService.prototype.processTransportWebhook = function(_body) {

   if (!_body || (_body.__casaWhRelayTransport !== true)) {
      return false;
   }

   if (_body.whrelayOriginId && (_body.whrelayOriginId === this.whrelayOriginId)) {
      return true;
   }

   if (this.whRelayMessageTransport && this.whRelayMessageTransport.receivedWhRelayTransportMessage(_body)) {
      return true;
   }

   if (this.whRelayDiscoveryTransport && this.whRelayDiscoveryTransport.receivedWhRelayDiscoveryMessage(_body)) {
      return true;
   }

   return true;
};

WhRelayService.prototype.createWhRelayMessageId = function(_kind, _data) {
   return [
      this.whrelayOriginId,
      _kind,
      _data.destAddress || _data.gang || _data.casaName || "broadcast",
      Date.now(),
      this.nextWhRelayMessageId++
   ].join(":");
};

WhRelayService.prototype.hasSeenWhRelayMessage = function(_data) {

   if (!_data.whrelayMessageId) {
      return false;
   }

   if (this.receivedWhRelayMessages.hasOwnProperty(_data.whrelayMessageId)) {
      return true;
   }

   this.receivedWhRelayMessages[_data.whrelayMessageId] = setTimeout( (_whrelayMessageId) => {
      delete this.receivedWhRelayMessages[_whrelayMessageId];
   }, this.receivedWhRelayMessageTimeoutMs, _data.whrelayMessageId);

   if (this.receivedWhRelayMessages[_data.whrelayMessageId].unref) {
      this.receivedWhRelayMessages[_data.whrelayMessageId].unref();
   }

   return false;
};

WhRelayService.prototype.sendTransportMessage = function(_kind, _body, _callback) {
   var body = util.copy(_body, true);

   body.__casaWhRelayTransport = true;
   body.whrelayKind = _kind;
   body.whrelayOriginId = this.whrelayOriginId;
   body.whrelayMessageId = this.createWhRelayMessageId(_kind, body);

   this.sendMessage(body, _callback);
};

WhRelayService.prototype.connected = function(_data) {
   console.log(this.uName + ": Connected to whrelay");

  // on connection, send our authentication request
  this.ws.send(JSON.stringify({action: 'auth', key: this.apiKey, secret: this.apiSecret}));
};

WhRelayService.prototype.error = function(_error) {
   console.error(this.uName + ": Error from whrelay channel ", _error);
};

WhRelayService.prototype.registerSource = function(_sourceName, _whrelayNode, _ignoreSourceCasa) {
   this.whrelaySources[_sourceName] = { handler: _whrelayNode, ignoreSourceCasa: _ignoreSourceCasa ? true : false };
};

WhRelayService.prototype.deRegisterSource = function(_sourceName) {
   delete this.whrelaySources[_sourceName];
};

WhRelayService.prototype.sendMessage = function(_body, _callback) {
   var callback = _callback;
   const https = require('https')
   var body = util.copy(_body);
   body.secret = this.apiSecret;
   body.sourceCasa = this.gang.casa.uName;
   const data = JSON.stringify(body);
   
   const options = {
      hostname: this.url,
      port: 443,
      path: "/",
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', 
        'Content-Length': data.length
      } 
   }    

   const req = https.request(options, res => {
      console.log(this.uName + ": Webhook Relay message send completed with " + `statusCode: ${res.statusCode}`);
   
      if (callback) {
         callback(null, true);
         callback = null;
      }
   });

   req.on('error', (_error) => {
      console.error(this.uName + ": Error trying to send smee message. Error: ", _error);

      if (callback) {
         callback(_error);
         callback = null;
      }
   });

   req.write(data);
   req.end();
};

WhRelayService.prototype.addHttpInfoToResponses = function(_target, _responses) {

   for (var i = 0; i < _responses.length; ++i) {
      _responses[i].http = {};
      _responses[i].http.method = "POST";
      _responses[i].http.contentType = "application/json";
      _responses[i].http.url = this.url;
      _responses[i].http.header = null;
   
      if (_responses[i].hasOwnProperty("property")) {
         _responses[i].http.body = { secret: this.apiSecret, uName: _target, propName: _responses[i].property, propValue: _responses[i].responseValue };
      } 
      else {
         _responses[i].http.body = { secret: this.apiSecret, uName: _target, eventName: _responses[i].event };
      }
   }    
}; 

WhRelayService.prototype.restartWhRelayClient = function() {

   try {
      this.ws.close();
      delete this.ws;
      this.start();
   }
   catch(_error) {
      console.error(this.uName + ": Unable to retstart link to WhRelay service. Error: ", _error);
   }
};

function Heartbeat(_owner, _interval) {
   this.owner = _owner;
}

Heartbeat.prototype.start = function() {
   this.startHeartbeatTimer();
};

Heartbeat.prototype.startHeartbeatTimer = function() {

   if (this.receiveTimeout) {
      clearTimeout(this.receiveTimeout);
      this.receiveTimeout = null;
   }

   this.receiveTimeout = setTimeout( () => {
      this.receiveTimeout = null;
      this.stop();
      this.owner.restartWhRelayClient();
   }, 60000);

};

Heartbeat.prototype.stop = function() {

   if (this.receiveTimeout) {
      clearTimeout(this.receiveTimeout);
      this.receiveTimeout = null;
   }
};

Heartbeat.prototype.heartbeatReceived = function(_msg) {
   console.log(this.owner.uName + ": Successfully received heartbeat before timeout has expired");
   this.startHeartbeatTimer();
};

module.exports = exports = WhRelayService;
module.exports.__testExports = {
   WhRelayMessageTransport: WhRelayMessageTransport,
   WhRelayDiscoveryTransport: WhRelayDiscoveryTransport
};

function WhRelayMessageTransport(_owner, _ioMessageSocketService) {
   AsyncEmitter.call(this);
   this.owner = _owner;
   this.ioMessageSocketService = _ioMessageSocketService;
}

util.inherits(WhRelayMessageTransport, AsyncEmitter);

WhRelayMessageTransport.prototype.start = function() {

   if (this.ioMessageSocketService) {
      this.ioMessageSocketService.addMessageTransport("whrelay", this);

      var consoleApiServiceName = this.owner.gang.casa.findServiceName("consoleapiservice");
      this.consoleApiService = consoleApiServiceName ? this.owner.gang.casa.findService(consoleApiServiceName) : null;

      if (this.consoleApiService) {
         this.consoleApiService.addIoTransport("whrelay");
      }
   }
};

WhRelayMessageTransport.prototype.localPeerAddress = function() {
   return new GangCasaAddress({
      gang: this.owner.gang.name,
      casa: this.owner.gang.casa.uName
   }).toString();
};

WhRelayMessageTransport.prototype.normaliseOutgoingPeerAddress = function(_data) {

   if (_data && (_data.peerAddress === this.owner.gang.casa.uName)) {
      _data.peerAddress = this.localPeerAddress();
   }
};

WhRelayMessageTransport.prototype.sendMessage = function(_message, _data) {
   var data = util.copy(_data, true);

   this.normaliseOutgoingPeerAddress(data);
   data.message = _message;
   this.owner.sendTransportMessage("message", data);
};

WhRelayMessageTransport.prototype.receivedWhRelayTransportMessage = function(_data) {

   if (!_data || (_data.whrelayKind !== "message")) {
      return false;
   }

   if (_data.destAddress !== this.localPeerAddress()) {
      return false;
   }

   if (this.owner.hasSeenWhRelayMessage(_data)) {
      return true;
   }

   delete _data.__casaWhRelayTransport;
   delete _data.whrelayKind;
   delete _data.whrelayOriginId;
   delete _data.whrelayMessageId;
   delete _data.secret;
   delete _data.sourceCasa;

   if (_data.hasOwnProperty("peerAddress") &&
       _data.hasOwnProperty("route") && _data.hasOwnProperty("id") &&
       _data.hasOwnProperty("destAddress") && _data.hasOwnProperty("message") &&
       _data.hasOwnProperty("messageData")) {
      this.asyncEmit(_data.message, _data);
   }
   else {
      console.error(this.owner.uName + ": Received malformed whrelay message transport envelope");
   }

   return true;
};

function WhRelayDiscoveryTransport(_owner, _name, _casaDiscoveryService, _messageTransportName, _tier) {
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

util.inherits(WhRelayDiscoveryTransport, AsyncEmitter);

WhRelayDiscoveryTransport.prototype.start = function() {
};

WhRelayDiscoveryTransport.prototype.localPeerAddress = function() {
   return new GangCasaAddress({
      gang: this.owner.gang.name,
      casa: this.owner.gang.casa.uName
   }).toString();
};

WhRelayDiscoveryTransport.prototype.sendDiscoveryMessage = function(_message, _data) {
   var data = util.copy(_data, true);

   data.discoveryMessage = _message;
   this.owner.sendTransportMessage("discovery", data);
};

WhRelayDiscoveryTransport.prototype.receivedWhRelayDiscoveryMessage = function(_data) {

   if (!_data || (_data.whrelayKind !== "discovery") || !_data.discoveryMessage) {
      return false;
   }

   if (!this.discoveryMessageRelevant(_data)) {
      return false;
   }

   if (this.owner.hasSeenWhRelayMessage(_data)) {
      return true;
   }

   if (_data.discoveryMessage === "status-request") {
      this.statusRequest(_data);
   }
   else if (_data.discoveryMessage === "status-update") {
      this.statusUpdate(_data);
   }
   else if (_data.discoveryMessage === "source-owner-request") {
      this.sourceOwnerRequest(_data);
   }
   else if (_data.discoveryMessage === "source-owner-response") {
      this.sourceOwnerResponse(_data);
   }

   return true;
};

WhRelayDiscoveryTransport.prototype.discoveryMessageRelevant = function(_data) {

   if ((_data.discoveryMessage === "source-owner-response") && (_data.requesterGang || _data.requesterCasa)) {
      return (_data.requesterGang === this.owner.gang.name) && (_data.requesterCasa === this.owner.gang.casa.uName);
   }

   return true;
};

WhRelayDiscoveryTransport.prototype.statusRequest = function(_data) {
   this.processGangCasaStatus(_data);

   if (_data.hasOwnProperty("gang") && (_data.gang !== this.owner.gang.name)) {
      return;
   }

   if (this.broadcasting && ((_data.hasOwnProperty("status") && (_data.status === "up")) || !_data.hasOwnProperty("status"))) {
      this.sendStatusUpdate("up");
   }
};

WhRelayDiscoveryTransport.prototype.statusUpdate = function(_data) {
   this.processGangCasaStatus(_data);
};

WhRelayDiscoveryTransport.prototype.processGangCasaStatus = function(_data) {

   if (!_data.hasOwnProperty("gang") || !_data.hasOwnProperty("status") ||
       !_data.hasOwnProperty("casaName") || !_data.hasOwnProperty("address")) {
      return;
   }

   if ((_data.gang === this.owner.gang.name) && (_data.casaName === this.owner.gang.casa.uName)) {
      return;
   }

   this.casaDiscoveryService.gangCasaStatusUpdate(_data.gang, _data.casaName, _data.status, _data.address, this.name, this.messageTransportName, this.tier);
};

WhRelayDiscoveryTransport.prototype.sendStatusUpdate = function(_status) {
   this.sendDiscoveryMessage("status-update", {
      gang: this.owner.gang.name,
      casaName: this.owner.gang.casa.uName,
      address: this.localPeerAddress(),
      status: _status
   });
};

WhRelayDiscoveryTransport.prototype.discoverSourceOwner = function(_request) {
   this.sendDiscoveryMessage("source-owner-request", {
      requestId: _request.requestId,
      gang: _request.gang,
      uName: _request.uName,
      property: _request.property,
      event: _request.event,
      requesterGang: this.owner.gang.name,
      requesterCasa: this.owner.gang.casa.uName
   });
};

WhRelayDiscoveryTransport.prototype.sourceOwnerRequest = function(_data) {

   if (!_data || (_data.requesterGang === this.owner.gang.name && _data.requesterCasa === this.owner.gang.casa.uName)) {
      return;
   }

   if (!this.casaDiscoveryService.canServeSourceOwnerRequest(_data)) {
      return;
   }

   this.sendDiscoveryMessage("source-owner-response", {
      requestId: _data.requestId,
      gang: this.owner.gang.name,
      uName: _data.uName,
      property: _data.property,
      event: _data.event,
      casaName: this.owner.gang.casa.uName,
      address: this.localPeerAddress(),
      requesterGang: _data.requesterGang,
      requesterCasa: _data.requesterCasa
   });
};

WhRelayDiscoveryTransport.prototype.sourceOwnerResponse = function(_data) {
   this.casaDiscoveryService.sourceOwnerStatusUpdate(_data, this.name, this.messageTransportName, this.tier);
};

WhRelayDiscoveryTransport.prototype.goingDown = function(_err) {
   this.sendStatusUpdate("down");
};

WhRelayDiscoveryTransport.prototype.startSearching = function() {
   this.sendDiscoveryMessage("status-request", {
      gang: this.owner.gang.name,
      casaName: this.owner.gang.casa.uName
   });
   this.searching = true;
};

WhRelayDiscoveryTransport.prototype.stopSearching = function() {
   this.searching = false;
};

WhRelayDiscoveryTransport.prototype.startBroadcasting = function() {
   this.sendDiscoveryMessage("status-request", {
      gang: this.owner.gang.name,
      casaName: this.owner.gang.casa.uName,
      address: this.localPeerAddress(),
      status: "up"
   });
   this.broadcasting = true;
};

WhRelayDiscoveryTransport.prototype.stopBroadcasting = function() {
   this.sendStatusUpdate("down");
   this.broadcasting = false;
};
