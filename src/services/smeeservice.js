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

   this.messageEventHandler = this.newEventReceived.bind(this);
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
        this.events = new EventSource("https://smee.io/" + this.channelName);
        this.events.reconnectInterval = 0;
        this.events.addEventListener('message', this.messageEventHandler);
        this.events.addEventListener('open', this.openEventHandler);
        this.events.addEventListener('error', this.errorEventHandler);

        this.heartbeat.start();
   }
   catch(_error) {
      console.error(this.uName + ": Unable to establish link to Smee service. Error: ", _error);
   }
};

SmeeService.prototype.newEventReceived = function(_msg) {

   if (_msg && _msg.hasOwnProperty("data")) {
      console.log(this.uName+": newEventReceived() request=", _msg.data);
      var data = JSON.parse(_msg.data);

      if (data && data.hasOwnProperty("body") && data.body.hasOwnProperty("uName") && data.body.hasOwnProperty("propName") && data.body.hasOwnProperty("propValue") /*&& this.props.hasOwnProperty(data.body.propName)*/) {
         console.log(this.uName+": newEventReceived() valid message!");

         if (this.smeeSources.hasOwnProperty(data.body.uName)) {
            console.log(this.uName+": newEventReceived() Forwarding message to node");
            this.smeeSources[data.body.uName].newEventReceived(data.body);
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

SmeeService.prototype.registerSource = function(_sourceName, _smeeNode) {
   this.smeeSources[_sourceName] = _smeeNode;
};

SmeeService.prototype.deRegisterSource = function(_sourceName) {
   delete this.smeeSources[_sourceName];
};

SmeeService.prototype.getUrl = function() {
   return "https://smee.io/" + this.channelName;
}

SmeeService.prototype.restartSmeClient = function() {

   try {
      this.events.removeEventListener('message', this.messageEventHandler);
      this.events.removeEventListener('open', this.openEventHandler);
      this.events.removeEventListener('error', this.errorEventHandler);
      delete this.events;
      this.start();
   }
   catch(_error) {
      console.error(this.uName + ": Unable to retstart link to Smee service. Error: ", _error);
   }
};

SmeeService.prototype.newEventReceived = function(_msg) {

   if (_msg && _msg.hasOwnProperty("data")) {
      console.log(this.uName+": newEventReceived() request=", _msg.data);
      var data = JSON.parse(_msg.data);

      if (data && data.hasOwnProperty("body") && data.body.hasOwnProperty("uName") && data.body.hasOwnProperty("propName") && data.body.hasOwnProperty("propValue") /*&& this.props.hasOwnProperty(data.body.propName)*/) {

         //if (data.body.uName !== "___heartbeat___") {
            console.log(this.uName+": newEventReceived() valid message!");
         //}

         if (this.smeeSources.hasOwnProperty(data.body.uName)) {
            console.log(this.uName+": newEventReceived() Frowarding message to node");
            this.smeeSources[data.body.uName].newEventReceived(data.body);
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
};

function Heartbeat(_owner, _interval) {
   this.owner = _owner;
   this.interval = _interval ? _interval : 60;
}

Heartbeat.prototype.start = function() {
   this.owner.registerSource("___heartbeat___"+this.owner.gang.casa.uName, this);
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

  try {
      const https = require('https')
      const data = JSON.stringify({ uName: "___heartbeat___"+this.owner.gang.casa.uName, propName: "___NA___", propValue: "___NA___" });

      const options = {
        hostname: 'smee.io',
        port: 443,
        path: '/'+this.owner.channelName,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length
        }
      }

      const req = https.request(options, res => {
        console.log(this.uName + ": Smee Heartbeat send completed with " + `statusCode: ${res.statusCode}`);
      })

      req.on('error', (_error) => {
        console.error(this.uName + ": Error trying to send smee heartbeat. Error: ", _error);
      })

      req.write(data);
      req.end();
      return true;
   }
   catch (_error) {
      console.error(this.uName + ": Unable to send heartbeat on smee channel "+_channel);
      return false;
   }
};

Heartbeat.prototype.newEventReceived = function(_msg) {

   if (this.receiveTimeout) {
      clearTimeout(this.receiveTimeout);
      this.receiveTimeout = null;
      console.log(this.owner.uName + ": Successfully received heartbeat before timeout has expired");
   }
};

module.exports = exports = SmeeService;
