var util = require('util');
var Thing = require('../thing');

function MqttTopic(_config, _parent) {
   this.id = _config.topic.replace(/:/g, "-");
   this.topic = _config.topic;

   for (var i = 0; i < _config.properties.length; ++i) {
      _config.properties[i].type = 'mqttproperty';
      _config.properties[i].topic = this.topic;
   }

   Thing.call(this, _config, _parent);
   this.thingType = "mqtt-topic";
}

util.inherits(MqttTopic, Thing);

module.exports = exports = MqttTopic;
