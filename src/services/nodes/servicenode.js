var util = require('util');
var Thing = require('../../thing');

function ServiceNode(_config, _owner) {
   Thing.call(this, _config, _owner);
   this.subscribers = {};
   this.subscribers[_config.subscription.subscriber] = true;
   this.createProperties(_config.subscription);
}

util.inherits(ServiceNode, Thing);

ServiceNode.prototype.newSubscriber = function(_subscription) {

   if (!this.subscribers.hasOwnProperty(_subscription.subscriber)) {
      this.subscribers[_subscription.subscriber] = true;
      this.createProperties(_subscription);
   }
};

ServiceNode.prototype.createProperties = function(_subscription) {

   if (_subscription.hasOwnProperty("subscriberProperties")) {
      this.subscriberProps = _subscription.subscriberProperties.slice();

      for (var i = 0; i < _subscription.subscriberProperties.length; ++i) {
         this.createProperty(_subscription.subscriberProperties[i], _subscription.subscriber);
      }
   }
   else {
      this.subscriberProps = [];
   }
};

ServiceNode.prototype.createProperty = function(_property, _subscriber) {

   if (this.props.hasOwnProperty(_property)) {
      this.props[_property].addNewSource({ uName: _subscriber, property: _property });
   }
   else {
      this.ensurePropertyExists(_property, 'property', { initialValue: 0, allSourcesRequiredForValidity: false,
                                                         source: { uName: _subscriber, property: _property }});
   }
};

ServiceNode.prototype.propertyAboutToChange = function(_propName, _propValue, _data) {
   console.log(this.uName + ":ServiceNode.prototype.propertyAboutToChange() property="+_propName);
   this.owner.notifyChange(this, _propName, _propValue, _data);
};

ServiceNode.prototype.addMissingProperties = function(_props) {

   for (var i = 0; i < this.subscriberProps.length; ++i) {

      if (!_props.hasOwnProperty(this.subscriberProps[i])) {
         _props[this.subscriberProps[i]] = this.getProperty(this.subscriberProps[i]);
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

