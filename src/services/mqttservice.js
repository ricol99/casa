var util = require('util');
var Service = require('../service');
const mqtt = require('mqtt')

function MqttService(_config, _owner) {
   Service.call(this, _config, _owner);

   this.mqttServerAddress = _config.mqttServerAddress;
   this.topics = {};

   this.deviceTypes = {
      "topic": "mqttservicetopic"
   };
}

util.inherits(MqttService, Service);

MqttService.prototype.coldStart = function() {
   Service.prototype.coldStart.call(this);

   this.mqttClient  = mqtt.connect(this.mqttServerAddress);

   this.mqttClient.on('message', (_topic, _message) => {
      console.log(this.uName + ": Received topic update from MQTT server, topic=" + _topic);

      if (this.topics.hasOwnProperty(_topic)) {
         var properies = JSON.parse(_message);

         for (var node in this.topics[_topic]) {
            this.topics[_topic][node].newTopicUpdateReceived(_topic, properties);
         }
      }
   });

   this.mqttClient.on('connect', () => {
      this.connected = true;

      for (var topic in this.topics) {
         this.subscribe(topic);
      }
   });

   this.mqttClient.on('disconnect', () => {
      this.connected = false;
   });

   this.mqttClient.on('reconnect', () => {
      this.connected = true;

      for (var topic in this.topics) {
         this.subscribe(topic);
      }
   });
};

MqttService.prototype.subscribeToTopic = function(_node, _topic) {
   var alreadySubscribed = this.topics.hasOwnProperty(_topic);

   if (!alreadySubscribed) {
      this.topics[_topic] = {};
   }

   this.topics[_topic][_node.name] = node;

   if (!alreadySubscribed && this.connected) {
      this.subscribe(_topic);
   }

   return true;
};

MqttService.prototype.subscribe = function(_topic) {

   this.mqttClient.subscribe(_topic, (_err, _granted) => {

      if (_err) {
         console.error("Unable to subscribe to topic!");
      }
   });
};

MqttService.prototype.publishTopicUpdate = function(_topic, _properties) {

   if (!this.connected) {
      console.error(this.uName + ": Unable to publish top update as not connected to the MQTT server");
      return;
   }

   console.log(this.uName + ": Publishing topic update, topic=" + _topic);
   this.mqttClient.publish(_topic, JSON.stringify(_properties));
}

module.exports = exports = MqttService;
 
