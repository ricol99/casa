var util = require('util');
var ServiceNode = require('./servicenode');

function KasaServicePlug(_config, _owner) {
   ServiceNode.call(this, _config, _owner);

   console.log(this.uName + ": New Kasa Plug Node created");
   this.ensurePropertyExists("power", 'property', { initialValue: false, allSourcesRequiredForValidity: false });
}

util.inherits(KasaServicePlug, ServiceNode);

// Called when current state required
KasaServicePlug.prototype.export = function(_exportObj) {
   ServiceNode.prototype.export.call(this, _exportObj);
};

// Called when current state required
KasaServicePlug.prototype.import = function(_importObj) {
   ServiceNode.prototype.import.call(this, _importObj);
};

KasaServicePlug.prototype.coldStart = function() {
   ServiceNode.prototype.coldStart.call(this);
};

KasaServicePlug.prototype.hotStart = function() {
   ServiceNode.prototype.hotStart.call(this);
};

KasaServicePlug.prototype.newSubscriptionAdded = function(_subscription) {
   console.log(this.uName + ": newSubscriptionAdded() args = ", _subscription.args);
   this.host = _subscription.args.host;
   this.port = _subscription.args.port;
   this.alias = _subscription.args.alias;
};

KasaServicePlug.prototype.setState = function(_properties, _callback) {
   var transaction = { action: "setState", properties: util.copy(_properties), callback: _callback };
   this.owner.queueTransaction(this, transaction);
};

KasaServicePlug.prototype.getState = function(_callback) {
   var transaction = { action: "getState", callback: _callback };
   this.owner.queueTransaction(this, transaction);
};
      
KasaServicePlug.prototype.transactionReadyForProcessing = function(_transaction) {
   return true;
};

KasaServicePlug.prototype.processPropertyChanged = function(_transaction, _callback) {
   console.log(this.uName + ": processPropertyChanged() transaction=", _transaction.properties);
   this.processSetState(_transaction, _callback);
};

KasaServicePlug.prototype.processSetState = function(_transaction, _callback) {
   console.log(this.uName + ": processSetState() transaction=", _transaction.properties);

   if (this.host && this.owner.devicesAvailable[this.host+":"+this.port]) {
      this.owner.devicesAvailable[this.host+":"+this.port].device.setPowerState(_transaction.properties.power);
      _callback(null, true);
   }
   else if (this.alias && this.owner.devicesAvailable[this.alias]) {
      this.owner.devicesAvailable[this.alias].device.setPowerState(_transaction.properties.power);
      _callback(null, true);
   }
   else {
      console.error(this.uName + ": Unable to find kasa device hosted at " + this.host);
   }
};

KasaServicePlug.prototype.processGetState = function(_transaction, _callback) {
   this.owner.devicesAvailable[this.host].getSysInfo().then((_info) => { _callback(null, _info.power) });
};

module.exports = exports = KasaServicePlug;

