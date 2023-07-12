var util = require('../../util');
var ServiceNode = require('../../servicenode');

function WhRelaySource(_config, _owner) {
   ServiceNode.call(this, _config, _owner);
   this.started = false;
}

util.inherits(WhRelaySource, ServiceNode);

// Called when current state required
WhRelaySource.prototype.export = function(_exportObj) {
   ServiceNode.prototype.export.call(this, _exportObj);
};

// Called when current state required
WhRelaySource.prototype.import = function(_importObj) {
   ServiceNode.prototype.import.call(this, _importObj);
};

WhRelaySource.prototype.coldStart = function() {
   ServiceNode.prototype.coldStart.call(this);
};

WhRelaySource.prototype.hotStart = function() {
   ServiceNode.prototype.hotStart.call(this);
};

WhRelaySource.prototype.newSubscriptionAdded = function(_subscription) {
   console.log(this.uName + ": newSubscriptionAdded() serviceProperty=" + _subscription.serviceProperty + ", args = ", _subscription.args);
   this.whRelaySource = _subscription.args.whRelaySource;
   
   this.start(_subscription.serviceProperty);
};

WhRelaySource.prototype.start = function(_property) {

   if (!this.started) {
      this.started = true;
      this.owner.registerSource(this.whRelaySource, this);
   }
}

WhRelaySource.prototype.newPropertyChangeReceived = function(_msg) {

   if (_msg && _msg.hasOwnProperty("propName") && _msg.hasOwnProperty("propValue") && this.properties.hasOwnProperty(_msg.propName)) {
      this.alignPropertyValue(_msg.propName, _msg.propValue);
   }
};

WhRelaySource.prototype.newEventReceived = function(_event) {
   console.log(this.uName + ": newEventReceived() Event=", _event);

   if (this.events.hasOwnProperty(_event.eventName)) {
      this.raiseEvent(_event.eventName);
   }
};

WhRelaySource.prototype.processPropertyChanged = function(_transaction, _callback) {

   // Only one property as optimisedTransactions set to false
   for (var first in _transaction.properties) {
      this.owner.sendMessage({ uName: this.whRelaySource, propName: first, propValue: _transaction.properties[first] }, _callback);
      break;
   }
};

WhRelaySource.prototype.processEventRaised = function(_transaction, _callback) {

   // Only one event as optimisedTransactions set to false
   for (var first in _transaction.events) {
      this.owner.sendMessage({ uName: this.whRelaySource, eventName: first }, _callback);
      break;
   }
};


module.exports = exports = WhRelaySource;
