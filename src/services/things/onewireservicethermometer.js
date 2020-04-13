var util = require('util');
var Thing = require('../../thing');

function OneWireServiceThermometer(_config, _owner) {
   Thing.call(this, _config, _owner);
   this.pollDuration = _config.hasOwnProperty("pollDuration") ? _config.pollDuration : 10000000;
   this.started = false;
   this.ensurePropertyExists("temperature", 'property', { initialValue: 0, }, this.config);
}

util.inherits(OneWireServiceThermometer, Thing);

OneWireServiceThermometer.prototype.propertySubscribedTo = function(_property, _subscription, _exists) {

   if (_subscription.hasOwnProperty("pollDuration")) {

      if (this.pollDuration === 10000000 || (_subscription.pollDuration < this.pollDuration)) {
         this.pollDuration = _subscription.pollDuration;

         if (this.started) {
            this.pollDevice();
         }
      }
   }

   if (!this.started) {
      this.start();
   }
};

OneWireServiceThermometer.prototype.propertyAboutToChange = function(_propName, _propValue, _data) {
   // Do nothing as read only
};

OneWireServiceThermometer.prototype.start = function() {
   this.started = true;

   this.owner.oneWireBus.getValueFrom(this.sName, "temperature")
   .then((_measure) => {
      this.alignPropertyValue("temperature", _measure.result.value);
      this.pollDevice();
   });
}

OneWireServiceThermometer.prototype.pollDevice = function() {

   if (this.timer) {
      clearTimeout(this.timer);
   }

   this.timer = setTimeout(() => {
      console.log(this.uName+": Reading from one wire. Device="+this.sName);
      this.owner.oneWireBus.getValueFrom(this.sName, "temperature")
      .then((_measure) => {
         this.alignPropertyValue("temperature", _measure.result.value);
         this.pollDevice();
      });
   }, this.pollDuration);
}

module.exports = exports = OneWireServiceThermometer;

