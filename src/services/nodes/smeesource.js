var util = require('util');
var ServiceNode = require('./servicenode');

function SmeeSource(_config, _owner) {
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

SmeeSource.prototype.newEventReceived = function(_event) {

   if (_event && _event.hasOwnProperty("propName") && _event.hasOwnProperty("propValue") && this.props.hasOwnProperty(_event.propName)) {
      this.alignPropertyValue(_event.propName, _event.propValue);
   }
};

SmeeSource.prototype.processPropertyChanged = function(_transaction, _callback) {
   // Do nothing, read only
   _callback(null, true);
};


module.exports = exports = SmeeSource;
