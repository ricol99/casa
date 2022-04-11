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

// Called when current state required
MqttTopic.prototype.export = function(_exportObj) {
   Thing.prototype.export.call(this, _exportObj);
};

// Called when current state required
MqttTopic.prototype.import = function(_importObj) {
   Thing.prototype.import.call(this, _importObj);
};

MqttTopic.prototype.coldStart = function() { 
   Thing.prototype.coldStart.call(this);
};

MqttTopic.prototype.hotStart = function() {
   Thing.prototype.hotStart.call(this);
};

module.exports = exports = MqttTopic;
