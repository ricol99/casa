var util = require('../../util');
var ServiceNode = require('../../servicenode');

function PushoverServiceGroup(_config, _owner) {
   ServiceNode.call(this, _config, _owner);

   console.log(this.uName + ": New Pushover Group Node created");
   this.userGroup = null;
}

util.inherits(PushoverServiceGroup, ServiceNode);

// Called when current state required
PushoverServiceGroup.prototype.export = function(_exportObj) {
   ServiceNode.prototype.export.call(this, _exportObj);
};

// Called when current state required
PushoverServiceGroup.prototype.import = function(_importObj) {
   ServiceNode.prototype.import.call(this, _importObj);
};

PushoverServiceGroup.prototype.coldStart = function() {
   ServiceNode.prototype.coldStart.call(this);
};

PushoverServiceGroup.prototype.hotStart = function() {
   ServiceNode.prototype.hotStart.call(this);
};

PushoverServiceGroup.prototype.newSubscriptionAdded = function(_subscription) {

   if (!this.userGroup) {
      this.userGroup = this.gang.findNamedObject(_subscription.args.userGroup);
   }

   if (!this.userGroup) {
      console.error(this.uName + ": ***** UserGroup not found! *************");
      process.exit(1);
   }

   this.destinationAddress = this.userGroup.getProperty('pushoverDestAddr');
};

//////////////////////////
// Callbacks from Service
//////////////////////////
PushoverServiceGroup.prototype.transactionReadyForProcessing = function(_transaction) {
   return true;
};

PushoverServiceGroup.prototype.processPropertyChanged = function(_transaction, _callback) {
   console.log(this.uName + ": processPropertyChanged() transaction=", _transaction.properties);

   if (!_transaction.coldStart) {

      // Only one property as optimisedTransactions set to false
      for (var first in _transaction.properties) {
         var messagePriority = _transaction.propData.hasOwnProperty("messagePriority") ? _transaction.propData.messagePriority : (_transaction.subscriber ? _transaction.subscriber.args.messagePriority : 0);
         this.owner.sendMessage(this.destinationAddress, messagePriority, _transaction.properties[first], _callback);
         break;
      }
   }
   else {
      _callback(null, true);
   }
};

PushoverServiceGroup.prototype.processEventRaised = function(_transaction, _callback) {
   console.log(this.uName + ": processEventRaised() transaction=", _transaction.events);

   // Only one event as optimisedTransactions set to false
   for (var first in _transaction.events) {
      var messagePriority = _transaction.eventData.hasOwnProperty("messagePriority") ? _transaction.eventData.messagePriority : (_transaction.subscriber ? _transaction.subscriber.args.messagePriority : 0);
      this.owner.sendMessage(this.destinationAddress, messagePriority, _transaction.events[first], _callback);
      break;
   }
};

module.exports = exports = PushoverServiceGroup;

