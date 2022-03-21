var util = require('util');
var ServiceNode = require('./servicenode');
var Gpio = require('onoff').Gpio;

function MqttServiceTopic(_config, _owner) {
   ServiceNode.call(this, _config, _owner);

   console.log(this.uName + ": New MQTT topic created");
}

util.inherits(MqttServiceTopic, ServiceNode);

MqttServiceTopic.prototype.newSubscriptionAdded = function(_subscription) {
   this.topic = _subscription.args.topic;

   if ((this.subscription.sync.startsWith("read") && !this.listening) {
      this.startListening();
   }
};

MqttServiceTopic.prototype.startListening = function() {
   this.listening = true;
   this.owner.subscribeToTopic(this.topic);
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

   for (var property = _properties) {

      if (this.properties.hasOwnProperty(property)) {
         this.alignPropertyValue(property, properties[property]);
      }
   }
};

module.exports = exports = MqttServiceTopic;

