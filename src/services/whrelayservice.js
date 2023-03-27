var util = require('util');
var Service = require('../service');
const WebSocket = require('ws');

function WhRelayService(_config, _owner) {
   Service.call(this, _config, _owner);

   this.deviceTypes = {
      "source": "whrelaysource"
   };

   this.apiKey = _config.apiKey;
   this.apiSecret = _config.apiSecret;
   this.bucketName = _config.bucket;
   this.url = _config.url;
   this.whrelaySources = {};

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
   }
   catch(_error) {
      console.error(this.uName + ": Unable to establish link to WhRelay service. Error: ", _error);

      setTimeout( () => {
         this.ws = null;
         this.heartbeat = null;
         this.start();
      }, 60000);
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
