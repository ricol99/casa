var util = require('util');
var ServiceNode = require('./servicenode');

function HueServiceLightGroup(_config, _owner) {
   ServiceNode.call(this, _config, _owner);

   this.id = _config.subscription.id;
   console.log(this.uName + ": New Hue Light Group Node created");
   this.ensurePropertyExists("power", 'property', { initialValue: false, allSourcesRequiredForValidity: false });
}

util.inherits(HueServiceLightGroup, ServiceNode);

HueServiceLightGroup.prototype.transactionReadyForProcessing = function(_transaction) {
   return true;
};

HueServiceLightGroup.prototype.processTransaction = function(_transaction, _callback) {

   if ((_transaction.properties.hasOwnProperty("power") && (_transaction.properties.power === true)) ||
       (this.getProperty("power") === true)) {
      
      this.addMissingProperties(_transaction.properties);
   }

   var config = this.owner.convertProperties(_transaction.properties);
   console.log(this.uName + ": AAAAA processTransaction() props="+util.inspect(_transaction.properties));
   this.owner.hue.setGroupLightState(this.id, config, _callback);
   return _callback(null, true);
};

module.exports = exports = HueServiceLightGroup;

