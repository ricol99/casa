var util = require('util');
var ServiceNode = require('./servicenode');

function SmeeSource(_config, _owner) {
   _config.optimiseTransactions = false;  // Only allow one event and property per transaction
   ServiceNode.call(this, _config, _owner);
   this.started = false;
}

util.inherits(SmeeSource, ServiceNode);

SmeeSource.prototype.newSubscriptionAdded = function(_subscription) {
   console.log(this.uName + ": newSubscriptionAdded() serviceProperty=" + _subscription.serviceProperty + ", args = ", _subscription.args);
   this.smeeSource = _subscription.args.smeeSource;
   
   this.start(_subscription.serviceProperty);
};

SmeeSource.prototype.start = function(_property) {

   if (!this.started) {
      this.started = true;
      this.owner.registerSource(this.smeeSource, this);
   }
}

SmeeSource.prototype.newPropertyChangeReceived = function(_msg) {

   if (_msg && _msg.hasOwnProperty("propName") && _msg.hasOwnProperty("propValue") && this.properties.hasOwnProperty(_msg.propName)) {
      this.alignPropertyValue(_msg.propName, _msg.propValue);
   }
};

SmeeSource.prototype.newEventReceived = function(_event) {
   console.log(this.uName + ": newEventReceived() Event=", _event);

   if (this.events.hasOwnProperty(_event.eventName)) {
      this.raiseEvent(_event.eventName);
   }
};

SmeeSource.prototype.processPropertyChanged = function(_transaction, _callback) {

   // Only one property as optimisedTransactions set to false
   for (var first in _transaction.properties) {
      this.owner.sendMessage({ uName: this.smeeSource, propName: first, propValue: _transaction.properties[first] }, _callback);
      break;
   }
};

SmeeSource.prototype.processEventRaised = function(_transaction, _callback) {

   // Only one event as optimisedTransactions set to false
   for (var first in _transaction.events) {
      this.owner.sendMessage({ uName: this.smeeSource, eventName: first }, _callback);
      break;
   }
};


module.exports = exports = SmeeSource;
