var util = require('util');
var ServiceNode = require('./servicenode');

function HueServiceLight(_config, _owner) {
   ServiceNode.call(this, _config, _owner);

   this.id = _config.subscription.id;
   console.log(this.uName + ": New Hue Light Node created");
   this.ensurePropertyExists("power", 'property', { initialValue: false, allSourcesRequiredForValidity: false });
}

util.inherits(HueServiceLight, ServiceNode);

HueServiceLight.prototype.transactionReadyForProcessing = function(_transaction, _callback) {
   var power = _transaction.properties.hasOwnProperty("power") ? _transaction.properties.power : this.getProperty("power");
   console.log(this.uName + ": Tranaction ready to process: ", _transaction);

   if (power === false) {
      // Not ready to process right now, try a requeue
      return _transaction.queued > 3;
   }

   _transaction.properties.power = true;
   var config = this.owner.convertProperties(_transaction.properties);
   //this.owner.hue.setLightState(this.deviceId, this.config, _callback);
   return true;
};

module.exports = exports = HueServiceLight;

