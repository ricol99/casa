var util = require('util');
var ServiceNode = require('./servicenode');


function OneWireServiceThermometer(_config, _owner) {
   ServiceNode.call(this, _config, _owner);
   console.log(this.uName + ": New thermometer created");
   this.pollDuration = _config.hasOwnProperty("pollDuration") ? _config.pollDuration : 10000000;
   this.started = false;
   this.ensurePropertyExists("temperature", 'property', { initialValue: 0, }, this.config);
}

util.inherits(OneWireServiceThermometer, ServiceNode);

// Called when current state required
OneWireServiceThermometer.prototype.export = function(_exportObj) {
   ServiceNode.prototype.export.call(this, _exportObj);
};

// Called when current state required
OneWireServiceThermometer.prototype.import = function(_importObj) {
   ServiceNode.prototype.import.call(this, _importObj);
};

OneWireServiceThermometer.prototype.coldStart = function() {
   ServiceNode.prototype.coldStart.call(this);
};

OneWireServiceThermometer.prototype.hotStart = function() {
   ServiceNode.prototype.hotStart.call(this);
};

OneWireServiceThermometer.prototype.newSubscriptionAdded = function(_subscription) {

   if (_subscription.args.hasOwnProperty("pollDuration")) {

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

OneWireServiceThermometer.prototype.start = function() {
   this.started = true;

   this.owner.oneWireBus.getValueFrom(this.name, "temperature")
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
      console.log(this.uName + ": Reading from one wire. Device="+this.name);
      this.owner.oneWireBus.getValueFrom(this.name, "temperature")
      .then((_measure) => {
         this.alignPropertyValue("temperature", _measure.result.value);
         this.pollDevice();
      });
   }, this.pollDuration);
}

OneWireServiceThermometer.prototype.processPropertyChanged = function(_transaction, _callback) {
   // Do nothing, read only
   _callback(null, true);
};

module.exports = exports = OneWireServiceThermometer;

