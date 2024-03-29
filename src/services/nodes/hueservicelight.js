var util = require('../../util');
var ServiceNode = require('../../servicenode');

function HueServiceLight(_config, _owner) {
   ServiceNode.call(this, _config, _owner);

   console.log(this.uName + ": New Hue Light Node created");
   this.ensurePropertyExists("power", 'property', { initialValue: false, allSourcesRequiredForValidity: false });
}

util.inherits(HueServiceLight, ServiceNode);

// Called when current state required
HueServiceLight.prototype.export = function(_exportObj) {
   ServiceNode.prototype.export.call(this, _exportObj);
};

// Called when current state required
HueServiceLight.prototype.import = function(_importObj) {
   ServiceNode.prototype.import.call(this, _importObj);
};

HueServiceLight.prototype.coldStart = function() {
   ServiceNode.prototype.coldStart.call(this);
};

HueServiceLight.prototype.hotStart = function() {
   ServiceNode.prototype.hotStart.call(this);
};

HueServiceLight.prototype.setState = function(_properties, _callback) {
   var transaction = { action: "setState", properties: util.copy(_properties), callback: _callback };
   this.owner.queueTransaction(this, transaction);
};

HueServiceLight.prototype.getState = function(_callback) {
   var transaction = { action: "getState", callback: _callback };
   this.owner.queueTransaction(this, transaction);
};
      
HueServiceLight.prototype.transactionReadyForProcessing = function(_transaction) {
   return true;
};

HueServiceLight.prototype.processPropertyChanged = function(_transaction, _callback) {
   console.log(this.uName + ": processPropertyChanged() transaction=", _transaction.properties);

   if (_transaction.properties.hasOwnProperty("power") && !_transaction.properties.power) {
      delete _transaction.properties;
      _transaction.properties = { power: false };
   }
   else if ((_transaction.properties.hasOwnProperty("power") && _transaction.properties.power) ||
       (this.getProperty("power") === true)) {

      this.addMissingProperties(_transaction.properties);
   }
   else {
      return _callback(null, true);
   }

   this.processSetState(_transaction, _callback);
};

HueServiceLight.prototype.processSetState = function(_transaction, _callback) {
   console.log(this.uName + ": processSetState() transaction=", _transaction.properties);

   var config = this.owner.convertProperties(_transaction.properties);
   this.owner.hue.setLightState(this.id, config, _callback);
}

HueServiceLight.prototype.processGetState = function(_transaction, _callback) {
   this.owner.hue.lightStatus(this.id, _callback);
};



module.exports = exports = HueServiceLight;

