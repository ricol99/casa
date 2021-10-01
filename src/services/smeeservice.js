var util = require('util');
const EventSource = require("eventsource");
var Service = require('./webservice');

function SmeeService(_config, _owner) {
   Service.call(this, _config, _owner);

   this.deviceTypes = {
      "source": "smeesource"
   };

   this.channelName = _config.channel;
   this.smeeSources = {};

   this.messageEventHandler = this.newMessageReceived.bind(this);
   this.openEventHandler = this.connected.bind(this);
   this.errorEventHandler = this.error.bind(this);
   this.heartbeat = new Heartbeat(this);
}

util.inherits(SmeeService, Service);

SmeeService.prototype.coldStart = function() {
   Service.prototype.coldStart.call(this);
   this.start();
};

SmeeService.prototype.start = function() {

   try { 
        this.smeeEvents = new EventSource("https://smee.io/" + this.channelName);
        this.smeeEvents.reconnectInterval = 0;
        this.smeeEvents.addEventListener('message', this.messageEventHandler);
        this.smeeEvents.addEventListener('open', this.openEventHandler);
        this.smeeEvents.addEventListener('error', this.errorEventHandler);

        this.heartbeat.start();
   }
   catch(_error) {
      console.error(this.uName + ": Unable to establish link to Smee service. Error: ", _error);
   }
};

SmeeService.prototype.newMessageReceived = function(_msg) {

   if (_msg && _msg.hasOwnProperty("data")) {
      console.log(this.uName+": newMessageReceived() request=", _msg.data);
      var data = JSON.parse(_msg.data);

      if (data && data.hasOwnProperty("body") && data.body.hasOwnProperty("uName")) {
         console.log(this.uName+": newMessageReceived() valid message!");

         if (this.smeeSources.hasOwnProperty(data.body.uName)) {

            if (!(data.body.hasOwnProperty("sourceCasa") && !this.smeeSources[data.body.uName].ignoreSourceCasa && (data.body.sourceCasa === this.casa.uName))) {

               if (data.body.hasOwnProperty("propName") && data.body.hasOwnProperty("propValue")) {
                  console.log(this.uName+": newMessageReceived() Forwarding property change message to node");
                  this.smeeSources[data.body.uName].handler.newPropertyChangeReceived(data.body);
               }
               else if (data.body.hasOwnProperty("eventName")) {
                  console.log(this.uName+": newMessageReceived() Forwarding event message to node");
                  this.smeeSources[data.body.uName].handler.newEventReceived(data.body);
               }
            }
         }
      }
   }
   else {
      console.error(this.uName + ": Received corrupt message from Smee channel " + this.channelName);
   }
};

SmeeService.prototype.connected = function(_data) {
   console.log(this.uName + ": Connected to smee channel "+ this.channelName);
};

SmeeService.prototype.error = function(_error) {
   console.error(this.uName + ": Error from smee channel ", _error);
};

SmeeService.prototype.registerSource = function(_sourceName, _smeeNode, _ignoreSourceCasa) {
   this.smeeSources[_sourceName] = { handler: _smeeNode, ignoreSourceCasa: _ignoreSourceCasa ? true : false };
};

SmeeService.prototype.deRegisterSource = function(_sourceName) {
   delete this.smeeSources[_sourceName];
};

SmeeService.prototype.getUrl = function() {
   return "https://smee.io/" + this.channelName;
}

SmeeService.prototype.sendMessage = function(_body, _callback) {

  try {
      var callback = _callback;
      const https = require('https')
      var body = util.copy(_body);
      body.sourceCasa = this.gang.casa.uName;
      const data = JSON.stringify(body);

      const options = {
        hostname: 'smee.io',
        port: 443,
        path: '/'+this.channelName,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length
        }
      }

      const req = https.request(options, res => {
         console.log(this.uName + ": Smee message send completed with " + `statusCode: ${res.statusCode}`);

         if (callback) {
            callback(null, true);
            callback = null;
         }
      })

      req.on('error', (_error) => {
         console.error(this.uName + ": Error trying to send smee message. Error: ", _error);

         if (callback) {
            callback(_error);
            callback = null;
         }
      })

      req.write(data);
      req.end();
   }
   catch (_error) {

      if (callback) {
         callback(_error);
         callback = null;
      }
   }
};

SmeeService.prototype.restartSmeClient = function() {

   try {
      this.smeeEvents.removeEventListener('message', this.messageEventHandler);
      this.smeeEvents.removeEventListener('open', this.openEventHandler);
      this.smeeEvents.removeEventListener('error', this.errorEventHandler);
      delete this.smeeEvents;
      this.start();
   }
   catch(_error) {
      console.error(this.uName + ": Unable to retstart link to Smee service. Error: ", _error);
   }
};

SmeeService.prototype.addHttpInfoToResponses = function(_target, _responses) {

   for (var i = 0; i < _responses.length; ++i) {
      _responses[i].http = {};
      _responses[i].http.method = "POST";
      _responses[i].http.contentType = "application/json";
      _responses[i].http.url = this.getUrl();
      _responses[i].http.header = null;

      if (_responses[i].hasOwnProperty("property")) {
         _responses[i].http.body = { uName: _target, propName: _responses[i].property, propValue: _responses[i].responseValue };
      }
      else {
         _responses[i].http.body = { uName: _target, eventName: _responses[i].event };
      }
   }
};

function Heartbeat(_owner, _interval) {
   this.owner = _owner;
   this.interval = _interval ? _interval : 60;
}

Heartbeat.prototype.start = function() {
   this.owner.registerSource("___heartbeat___"+this.owner.gang.casa.uName, this, true);
   this.sendHeartbeatAndStartTimers();

};

Heartbeat.prototype.sendHeartbeatAndStartTimers = function() {

   if (this.sendTimeout) {
      clearTimeout(this.sendTimeout);
      this.sendTimeout = null;
   }

   if (this.receiveTimeout) {
      clearTimeout(this.receiveTimeout);
      this.receiveTimeout = null;
   }

   this.receiveTimeout = setTimeout( () => {
      this.receiveTimeout = null;
      this.stop();
      this.owner.restartSmeClient();
   }, 5000);

   this.sendHeartbeat();

   this.sendTimeout = setTimeout( () => {
      this.sendTimeout = null;
      this.sendHeartbeatAndStartTimers();
   }, this.interval * 1000);

};

Heartbeat.prototype.stop = function() {
   this.owner.deRegisterSource("___heartbeat___"+this.owner.gang.casa.uName);

   if (this.sendTimeout) {
      clearTimeout(this.sendTimeout);
      this.sendTimeout = null;
   }

   if (this.receiveTimeout) {
      clearTimeout(this.receiveTimeout);
      this.receiveTimeout = null;
   }
};

Heartbeat.prototype.sendHeartbeat = function() {
   this.owner.sendMessage({ uName: "___heartbeat___"+this.owner.gang.casa.uName, eventName: "heartbeat" });
};

Heartbeat.prototype.newPropertyChangeReceived = function(_msg) {
};

Heartbeat.prototype.newEventReceived = function(_msg) {

   if (this.receiveTimeout) {
      clearTimeout(this.receiveTimeout);
      this.receiveTimeout = null;
      console.log(this.owner.uName + ": Successfully received heartbeat before timeout has expired");
   }
};

module.exports = exports = SmeeService;
