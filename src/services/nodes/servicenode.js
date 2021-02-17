var util = require('util');
var Thing = require('../../thing');

function ServiceNode(_config, _owner) {
   Thing.call(this, _config, _owner);
   this.subscribers = {};
   this.serviceProps = [];
   this.sync = { read: false, write: false };
   this.id = _config.id;

   if (_config.hasOwnProperty("subscription")) {
      this.processSubscription(_config.subscription);
   }
}

util.inherits(ServiceNode, Thing);

ServiceNode.prototype.coldStart = function() {
};

// Something wants to watch (and possibly write to) several properties in this service node (read) - called from sourcelistener
ServiceNode.prototype.propertySubscribedTo = function(_property, _subscription, _exists) {
   this.processSubscription(_subscription);
};

// Override this to be informed everytime a new subscription is added
ServiceNode.prototype.newSubscriptionAdded = function(_subscription) {
};

ServiceNode.prototype.processSubscription = function(_subscription) {

   if (!this.subscribers.hasOwnProperty(_subscription.subscriber)) {
      this.subscribers[_subscription.subscriber] = { uName: _subscription.subscriber, props: {}, args: _subscription.args };
   }

   var sub = this.subscribers[_subscription.subscriber];

   sub.sync = _subscription.hasOwnProperty("sync") ? _subscription.sync : "read";
   this.sync.read = this.sync.read || _subscription.sync.startsWith("read");
   this.sync.write = this.sync.write || _subscription.sync.endsWith("write");

   if (_subscription.hasOwnProperty("serviceProperty")) {
      sub.props[_subscription.serviceProperty] = _subscription.hasOwnProperty("subscriberProperty") ? _subscription.subscriberProperty : _subscription.serviceProperty;
      this.createProperty(_subscription.serviceProperty, _subscription.subscriberProperty, sub);
   }
   this.newSubscriptionAdded(sub);
};

ServiceNode.prototype.createProperty = function(_property, _subscriberProp, _sub) {

   if (this.props.hasOwnProperty(_property)) {

      if (_sub.sync !== "read") {
         this.props[_property].addNewSource({ uName: _sub.uName, property: _subscriberProp });
      }
   }
   else {

      if (_sub.sync === "read") {
         this.ensurePropertyExists(_property, 'property', { initialValue: 0, allSourcesRequiredForValidity: false });
      }
      else {
         this.ensurePropertyExists(_property, 'property', { initialValue: 0, allSourcesRequiredForValidity: false,
                                                            source: { uName: _sub.uName, property: _subscriberProp }});
      }

      this.serviceProps.push(_property);
   }
};

ServiceNode.prototype.propertyAboutToChange = function(_propName, _propValue, _data) {
   console.log(this.uName + ":ServiceNode.prototype.propertyAboutToChange() property="+_propName);
   this.owner.notifyChange(this, _propName, _propValue, _data);
};

ServiceNode.prototype.addMissingProperties = function(_props) {

   for (var i = 0; i < this.serviceProps.length; ++i) {

      if (!_props.hasOwnProperty(this.serviceProps[i])) {
         _props[this.serviceProps[i]] = this.getProperty(this.serviceProps[i]);
      }
   }
};

// Override this to indicate if a transaction is ready to come off the queue
// @return true - transaction ready processed
//         false - transaction not ready to be processed, please requeue if possible
ServiceNode.prototype.transactionReadyForProcessing = function(_transaction) {
   return true;
};

module.exports = exports = ServiceNode;

