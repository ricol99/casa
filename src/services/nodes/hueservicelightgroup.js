var util = require('util');
var ServiceNode = require('./servicenode');

function HueServiceLightGroup(_config, _owner) {
   ServiceNode.call(this, _config, _owner);

   this.id = _config.subscription.id;
   console.log(this.uName + ": New Hue Light Group Node created");
   this.ensurePropertyExists("power", 'property', { initialValue: false, allSourcesRequiredForValidity: false });
}

util.inherits(HueServiceLightGroup, ServiceNode);

HueServiceLightGroup.prototype.setState = function(_properties, _callback) {
   var transaction = { action: "setState", properties: util.copy(_properties), callback: _callback };
   this.owner.queueTransaction(this, transaction);
};

//////////////////////////
// Callbacks from Service
//////////////////////////
HueServiceLightGroup.prototype.transactionReadyForProcessing = function(_transaction) {
   return true;
};

HueServiceLightGroup.prototype.processPropertyChanged = function(_transaction, _callback) {
   console.log(this.uName + ": processPropertyChanged() transaction=", _transaction.properties);

   if ((_transaction.properties.hasOwnProperty("power") && (_transaction.properties.power === true)) ||
       (this.getProperty("power") === true)) {
      
      this.addMissingProperties(_transaction.properties);
   }

   this.processSetState(_transaction, _callback);
};

HueServiceLightGroup.prototype.processSetState = function(_transaction, _callback) {
   console.log(this.uName + ": processSetState() transaction=", _transaction.properties);

   var config = this.owner.convertProperties(_transaction.properties);
   this.owner.hue.setGroupLightState(this.id, config, _callback);
}

module.exports = exports = HueServiceLightGroup;

