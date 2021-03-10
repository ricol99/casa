var util = require('util');
var ServiceNode = require('./servicenode');

function PushoverServiceGroup(_config, _owner) {
   ServiceNode.call(this, _config, _owner);

   console.log(this.uName + ": New Pushover Group Node created");
   this.ensurePropertyExists("message", 'property', { initialValue: false, allSourcesRequiredForValidity: false });
   this.userGroup = null;
}

util.inherits(PushoverServiceGroup, ServiceNode);

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

   if (!_transaction.properties.hasOwnProperty("message") && (!_transaction.properties.message)) {
      return _callback("No message passed to send!");
   }

   if (!_transaction.coldStart) {
      var messagePriority = _transaction.subscriber ? _transaction.subscriber.args.messagePriority : 0;
      this.sendMessage(messagePriority, _transaction.properties.message, _callback);
   }
};


PushoverServiceGroup.prototype.sendMessage = function(_messagePriority, _message, _callback) {
   var title = 'Casa Collin' + ((_messagePriority > 0) ? ' Alarm' : ' Update');

   if (_message !== "") {
      var msg = {
         user: this.destinationAddress,
         message: _message,    // required
         title: title,
         retry: 60,
         expire: 3600,
         priority: _messagePriority
      };

      try {
         this.owner.pushover.send(msg, _callback);
      }
      catch (_err) {
         _callback("Error logging into Pushover: " + _err);
      }
   }
   else {
      _callback("Message empty - not sending!");
   }
};

module.exports = exports = PushoverServiceGroup;

