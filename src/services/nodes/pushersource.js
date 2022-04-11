var util = require('util');
var ServiceNode = require('./servicenode');

function PusherSource(_config, _owner) {
   ServiceNode.call(this, _config, _owner);
   this.started = false;
   this.subscriptions = {};
}

util.inherits(PusherSource, ServiceNode);

// Called when current state required
PusherSource.prototype.export = function(_exportObj) {
   ServiceNode.prototype.export.call(this, _exportObj);
};

// Called when current state required
PusherSource.prototype.import = function(_importObj) {
   ServiceNode.prototype.import.call(this, _importObj);
};

PusherSource.prototype.coldStart = function() {
   ServiceNode.prototype.coldStart.call(this);
};

PusherSource.prototype.hotStart = function() {
   ServiceNode.prototype.hotStart.call(this);
};

PusherSource.prototype.newSubscriptionAdded = function(_subscription) {
   console.log(this.uName + ": newSubscriptionAdded() serviceProperty=" + _subscription.serviceProperty + ", args = ", _subscription.args);
   this.pusherSource = _subscription.args.pusherSource;
   
   this.start(_subscription.serviceProperty);
};

PusherSource.prototype.start = function(_property) {

   try {

      if (!this.started) {
         var channel = this.owner.pusher.subscribe(this.pusherSource.replace(/:/g, "_"));

         channel.bind("property-changed", (_data) => {
            console.log(this.uName + ": Property Change: name: " + _data.propName + ", value: " + _data.propValue);

            if (_data && _data.hasOwnProperty("propName") && _data.hasOwnProperty("propValue") && this.properties.hasOwnProperty(_data.propName)) {
               this.alignPropertyValue(_data.propName, _data.propValue);
            }
         }, this);

         this.started = true;
      }

      if (!this.subscriptions.hasOwnProperty(_property)) {
         this.subscriptions[_property] = new Subscription(_property, this);
      }
   }
   catch (_error) {
      console.error(this.uName + ": Unable to bind to Pusher channel. Error: ", _error);
   }
}

PusherSource.prototype.processPropertyChanged = function(_transaction, _callback) {
   // Do nothing, read only
   _callback(null, true);
};

function Subscription(_property, _owner) {
   this.owner = _owner;
   this.property = _property;
   this.owner.owner.sendMessage("control-channel", "subscription-request", { sourceName: this.owner.gang.casa.uName, uName: this.owner.pusherSource, propName: _property });
   this.resetTimeout();
};

Subscription.prototype.resetTimeout = function() {

   this.timeout = setTimeout( () => {
      this.owner.owner.sendMessage("control-channel", "subscription-request", { sourceName: this.owner.gang.casa.uName, uName: this.owner.pusherSource, propName: this.property });
      this.resetTimeout();
   }, 23*3600000);
};

module.exports = exports = PusherSource;
