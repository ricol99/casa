var util = require('util');
var Thing = require('../thing');

function MqttTopic(_config, _parent) {
   Thing.call(this, _config, _parent);
   this.thingType = "mqtt-topic";
   this.topic = _config.topic;
   this.id = _config.topic.replace(/:/g, "-");
   this.serviceName = (_config.hasOwnProperty("serviceName")) ? _config.serviceName :  this.gang.casa.findServiceName("mqttservice");
   this.sync = _config.hasOwnProperty("sync") ? _config.sync : "read";

   if (!this.serviceName) {
      console.error(this.uName + ": ***** Mqtt service not found! *************");
      process.exit();
   }

   for (var i = 0; i < _config.properties.length; ++i) {
      this.ensurePropertyExists(_config.properties[i].name, 'serviceproperty', { id: this.id, serviceType: "topic", serviceName: this.serviceName,
                                sync: this.sync, serviceArgs: { topic: this.topic,  sync: this.sync }}, _config);
   }
}

util.inherits(MqttTopic, Thing);

module.exports = exports = MqttTopic;
