var util = require('../../util');
var ServiceNode = require('../../servicenode');

function MqttServiceTopic(_config, _owner) {
   ServiceNode.call(this, _config, _owner);
   this.listening = false;

   console.log(this.uName + ": New MQTT topic created");
}

util.inherits(MqttServiceTopic, ServiceNode);

// Called when current state required
MqttServiceTopic.prototype.export = function(_exportObj) {
   ServiceNode.prototype.export.call(this, _exportObj);
};

// Called when current state required
MqttServiceTopic.prototype.import = function(_importObj) {
   ServiceNode.prototype.import.call(this, _importObj);
};

MqttServiceTopic.prototype.coldStart = function() {
   ServiceNode.prototype.coldStart.call(this);
};

MqttServiceTopic.prototype.hotStart = function() {
   ServiceNode.prototype.hotStart.call(this);
};

MqttServiceTopic.prototype.newSubscriptionAdded = function(_subscription) {
   this.topic = _subscription.args.topic;
   console.log(this.uName + ": newSubscriptionAdded() topic=" + this.topic);

   if (_subscription.sync.startsWith("read") && !this.listening) {
      this.startListening();
   }
};

MqttServiceTopic.prototype.startListening = function() {
   this.listening = true;
   this.owner.subscribeToTopic(this, this.topic);
};

MqttServiceTopic.prototype.setState = function(_properties, _callback) {
   var transaction = { action: "setState", properties: util.copy(_properties), callback: _callback };
   this.owner.queueTransaction(this, transaction);
};

MqttServiceTopic.prototype.transactionReadyForProcessing = function(_transaction) {
   return true;
};

MqttServiceTopic.prototype.processPropertyChanged = function(_transaction, _callback) {
   console.log(this.uName + ": processPropertyChanged() transaction=", _transaction.properties);
   this.processSetState(_transaction, _callback);
};

MqttServiceTopic.prototype.processSetState = function(_transaction, _callback) {
   console.log(this.uName + ": processSetState() transaction=", _transaction.properties);
   this.owner.publishTopicUpdate(this.topic, _transaction.properties, _callback);
};

MqttServiceTopic.prototype.newTopicUpdateReceived = function(_properties) {

   for (var property in _properties) {

      if (this.properties.hasOwnProperty(property)) {
         this.alignPropertyValue(property, _properties[property]);
      }
   }
};

module.exports = exports = MqttServiceTopic;

