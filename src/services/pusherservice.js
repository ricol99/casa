var util = require('util');
var Service = require('../service');
var Pusher = require("pusher-js");
var PusherServer = require("pusher");

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

      this.pusherServer = new PusherServer({ appId: this.appId,
                                             key: this.appKey,
                                             secret: this.appSecret,
                                             cluster: this.appCluster });

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
      console.error(this.uName + ": Unable to publish message on channel "+_channel);
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

module.exports = exports = PusherService;
