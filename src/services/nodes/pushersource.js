var util = require('util');
var ServiceNode = require('./servicenode');

function PusherSource(_config, _owner) {
   ServiceNode.call(this, _config, _owner);
   this.started = false;
}

util.inherits(PusherSource, ServiceNode);

PusherSource.prototype.newSubscriptionAdded = function(_subscription) {
   console.log(this.uName + ": newSubscriptionAdded() serviceProperty=" + _subscription.serviceProperty + ", args = ", _subscription.args);
   this.pusherSource = _subscription.args.pusherSource;
   
   this.start();
};

PusherSource.prototype.start = function() {

   if (!this.started) {
      var channel = this.owner.pusher.subscribe(this.pusherSource.replace(/:/g, "_"));

      channel.bind("property-changed", (_data) => {
         console.log(this.uName + ": Property Change: name: " + _data.propName + ", value: " + _data.propValue);

         if (_data && _data.hasOwnProperty("propName") && _data.hasOwnProperty("propValue") && this.props.hasOwnProperty(_data.propName)) {
            this.alignPropertyValue(_data.propName, _data.propValue);
         }
      }, this);

      this.started = true;
   }
}

PusherSource.prototype.processPropertyChanged = function(_transaction, _callback) {
   // Do nothing, read only
   _callback(null, true);
};


module.exports = exports = PusherSource;
