var util = require('./util');
var Thing = require('./thing');

function ServiceNode(_config, _owner) {
   _config.propogateToParent = false;

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

// Called when current state required
ServiceNode.prototype.export = function(_exportObj) {
   Thing.prototype.export.call(this, _exportObj);
};

// Called when current state required
ServiceNode.prototype.import = function(_importObj) {
   Thing.prototype.import.call(this, _importObj);
};

ServiceNode.prototype.coldStart = function() {
   Thing.prototype.coldStart.call(this);
};

ServiceNode.prototype.hotStart = function() {
   Thing.prototype.hotStart.call(this);
};

// Something wants to watch (and possibly write to) several properties in this service node (read) - called from sourcelistener
ServiceNode.prototype.propertySubscribedTo = function(_property, _subscription, _exists) {
   console.log(this.uName + ": Property subscription() for " + _property);
   this.processSubscription(_subscription);
};

// Something wants to watch (and possibly raise towards) several events in this service node (read) - called from sourcelistener
ServiceNode.prototype.eventSubscribedTo = function(_eventName, _subscription) {
   console.log(this.uName + ": Event subscription() for" + _eventName);
   this.processSubscription(_subscription);
};

// Override this to be informed everytime a new subscription is added
ServiceNode.prototype.newSubscriptionAdded = function(_subscription) {
};

ServiceNode.prototype.processSubscription = function(_subscription) {

   if (!_subscription || !_subscription.hasOwnProperty("subscriber") || _subscription.subscriber === this.uName) {
      return;
   }

   if (!this.subscribers.hasOwnProperty(_subscription.subscriber)) {
      this.subscribers[_subscription.subscriber] = { uName: _subscription.subscriber, properties: {}, events: {}, args: _subscription.args };
   }

   var sub = this.subscribers[_subscription.subscriber];

   sub.sync = _subscription.hasOwnProperty("sync") ? _subscription.sync : "read";
   sub.serviceProperty = _subscription.serviceProperty;
   this.sync.read = this.sync.read || _subscription.sync.startsWith("read");
   this.sync.write = this.sync.write || _subscription.sync.endsWith("write");

   if (_subscription.hasOwnProperty("serviceProperty")) {
      sub.properties[_subscription.serviceProperty] = _subscription.hasOwnProperty("subscriberProperty") ? _subscription.subscriberProperty : _subscription.serviceProperty;
      this.createProperty(_subscription.serviceProperty, _subscription.subscriberProperty, sub);
   }
   else if (_subscription.hasOwnProperty("serviceEvent")) {
      sub.events[_subscription.serviceEvent] = _subscription.hasOwnProperty("subscriberEvent") ? _subscription.subscriberEvent : _subscription.serviceEvent;
      this.createEvent(_subscription.serviceEvent, _subscription.subscriberEvent, sub);
   }
   this.newSubscriptionAdded(sub);
};

ServiceNode.prototype.createProperty = function(_property, _subscriberProp, _sub) {

   if (this.properties.hasOwnProperty(_property)) {

      if (_sub.sync !== "read") {
         this.properties[_property].addNewSource({ uName: _sub.uName, property: _subscriberProp });
      }
   }
   else {

      if (_sub.sync === "read") {
         this.ensurePropertyExists(_property, 'property', { initialValue: 0, allSourcesRequiredForValidity: false });
      }
      else {
         this.ensurePropertyExists(_property, 'property', { allSourcesRequiredForValidity: false,
                                                            source: { uName: _sub.uName, property: _subscriberProp }});
         console.log(this.uName + ": AAAAAA ============= createProperty() property " + _property + " created with uName " + this.properties[_property].uName + " and source " + _sub.uName + " and sub prop " + _subscriberProp);
      }

      this.serviceProps.push(_property);
   }
};

ServiceNode.prototype.createEvent = function(_eventName, _subscriberEvent, _sub) {

   if (this.events.hasOwnProperty(_eventName)) {

      if (_sub.sync !== "read") {
         this.events[_eventName].addNewSource({ uName: _sub.uName, event: _subscriberEvent });
      }
   }
   else {

      if (_sub.sync === "read") {
         this.ensureEventExists(_eventName, 'servicenodeevent', { serviceEventName: _eventName });
      }
      else {
         this.ensureEventExists(_eventName, 'servicenodeevent', { serviceEventName: _eventName, source: { uName: _sub.uName, event: _subscriberEvent }});
      }
   }
};

// Called by event listening to subscriber (ServiceNodeEvent)
ServiceNode.prototype.eventReceivedFromSubscriber = function(_eventName, _data) {
   this.owner.notifyEvent(this, _eventName, _data, this.subscribers[_data.sourceName]);
};

ServiceNode.prototype.propertyAboutToChange = function(_propName, _propValue, _data) {
   console.log(this.uName + ":ServiceNode.prototype.propertyAboutToChange() property="+_propName);

   if (!(_data.hasOwnProperty("sourceName") && (_data.sourceName === this.uName))) {
      this.owner.notifyChange(this, _propName, _propValue, _data, this.subscribers[_data.sourceName]);
   }
   else {
      console.log(this.uName + ": Property was changed locally, not from source. Source name ="+_data.sourceName);
   }
};

ServiceNode.prototype.addMissingProperties = function(_properties) {

   for (var i = 0; i < this.serviceProps.length; ++i) {

      if (!_properties.hasOwnProperty(this.serviceProps[i])) {
         _properties[this.serviceProps[i]] = this.getProperty(this.serviceProps[i]);
      }
   }
};

ServiceNode.prototype.raiseEvent = function(_eventName, _data) {
   var data = (_data) ? util.copy(_data) : { sourceName: this.uName };
   data.sourceService = this.uName;

   Thing.prototype.raiseEvent.call(this, _eventName, data);
};

// Override this to indicate if a transaction is ready to come off the queue
// @return true - transaction ready processed
//         false - transaction not ready to be processed, please requeue if possible
ServiceNode.prototype.transactionReadyForProcessing = function(_transaction) {
   return true;
};


// Override this to process a property changed transaction that is now ready to execute
ServiceNode.prototype.processPropertyChanged = function(_transaction, _callback) {
};

// Override this to process a event transaction that is now ready to execute
ServiceNode.prototype.processEventRaised = function(_transaction, _callback) {
};

module.exports = exports = ServiceNode;

