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
}

util.inherits(SmeeService, Service);

SmeeService.prototype.coldStart = function() {

   Service.prototype.coldStart.call(this);

   try { 
        this.events = new EventSource("https://smee.io/" + this.channelName);
        this.events.reconnectInterval = 0;
        this.events.addEventListener('message', this.newEventReceived.bind(this));
        this.events.addEventListener('open', this.connected.bind(this));
        this.events.addEventListener('error', this.error.bind(this));
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
   console.error(this.uName + ": Error from smee channel ", _error);
};

SmeeService.prototype.registerSource = function(_sourceName, _smeeNode) {
   this.smeeSources[_sourceName] = _smeeNode;
};

module.exports = exports = SmeeService;
