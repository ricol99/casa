var util = require('util');
var ServiceNode = require('./servicenode');

function PusherSubscription(_config, _owner) {
   ServiceNode.call(this, _config, _owner);
   this.started = false;
   this.pusherSubscriptions = {};
   this.noOfPusherSubscriptions = 0;
}

util.inherits(PusherSubscription, ServiceNode);

// Called when current state required
PusherSubscription.prototype.export = function(_exportObj) {
   ServiceNode.prototype.export.call(this, _exportObj);
};

// Called when current state required
PusherSubscription.prototype.import = function(_importObj) {
   ServiceNode.prototype.import.call(this, _importObj);
};

PusherSubscription.prototype.coldStart = function() {
   ServiceNode.prototype.coldStart.call(this);
};

PusherSubscription.prototype.hotStart = function() {
   ServiceNode.prototype.hotStart.call(this);
};

PusherSubscription.prototype.newSubscriptionAdded = function(_subscription) {
   console.log(this.uName + ": newSubscriptionAdded() serviceProperty=" + _subscription.serviceProperty + ", args = ", _subscription.args);
   this.subscriptionUName = _subscription.args.subscriptionUName;

   var num = (this.pusherSubscriptions.hasOwnProperty(_subscription.args.sourceName+":"+_subscription.serviceProperty)) ? this.pusherSubscriptions[_subscription.args.sourceName+":"+_subscription.serviceProperty] + 1 : 1;
   this.pusherSubscriptions[_subscription.args.sourceName+":"+_subscription.serviceProperty] = num;
};

PusherSubscription.prototype.processPropertyChanged = function(_transaction, _callback) {

   try {
      for (var prop in _transaction.properties) {

         if (_transaction.properties.hasOwnProperty(prop)) {
            
            this.owner.sendMessage(this.subscriptionUName.replace(/:/g, "_"), "property-changed",
                                   { propName: prop, propValue: _transaction.properties[prop] });
         }
      }
      _callback(null, true);
   }
   catch (_error) {
      _callback(_error);
   }
};


PusherSubscription.prototype.removePusherSubscription = function(_sourceName, _property) {

   if (this.pusherSubscriptions.hasOwnProperty(_sourceName+":"+_property)) {
      var num = this.pusherSubscriptions[_sourceName+":"+_property] - 1;
      this.pusherSubscriptions[_sourceName+":"+_property] = num;

      if (this.pusherSubscriptions[_sourceName+":"+_property] === 0) {
         delete this.pusherSubscriptions[_sourceName+":"+_property];
         this.noOfPusherSubscriptions = this.noOfPusherSubscriptions - 1;

         if (this.noOfPusherSubscriptions === 0) {
            // TBD Should remove all resources
            //this.detach();
         }
      }
   }
};

module.exports = exports = PusherSubscription;
