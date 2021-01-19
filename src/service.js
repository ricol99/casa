var util = require('./util');
var Thing = require('./thing');

function Service(_config, _owner) {

   if (!_config.hasOwnProperty("local")) {
      _config.local = true;
   }

   if (!_config.hasOwnProperty("propogateToChildren")) {
      _config.propogateToChildren = false;
   }

   Thing.call(this, _config, _owner);

   this.queueQuant = _config.hasOwnProperty("queueQuant") ? _config.queueQuant : 100;
   this.queueRetryLimit = _config.hasOwnProperty("queueRetryLimit") ? _config.queueRetryLimit : 5;
   this.localThings = _config.hasOwnProperty("localThings") ? _config.localThings : true;
   this.transactions = {};
   this.queue = [];
   this.queueTimer = null;
}

util.inherits(Service, Thing);

Service.prototype.createThing = function(_config) {
   var type = _config.type;
   _config.propogateToParent = (_config.hasOwnProperty('propogateToParent')) ? _config.propogateToParent : false;
   _config.local = (_config.hasOwnProperty("local")) ? _config.local : this.localThings;

   var ServiceOwnedThing = require("./services/things/"+type);
   var thing = new ServiceOwnedThing(_config, this);
   this.gang.casa.refreshSourceListeners();

   return thing;
};

Service.prototype.notifyChange = function(_serviceNode, _propName, _propValue, _data) {

   if (_data.hasOwnProperty("transactionId") && this.transactions.hasOwnProperty(_data.transactionId)) {

      if (_serviceNode.name !== this.transactions[_data.transactionId].serviceNode.name) {
         console.error(this.uName + ":Transaction is across two different service nodes. Not allowed! Service node " + _serviceNode.name + " and " + this.transactions[_data.transactionId].serviceNode.name);
      }
      else {
      console.log(this.uName + ": AAAA HERE C!");
         this.transactions[_data.transactionId].properties[_propName] = _propValue;
      }
   }
   else {
      console.log(this.uName + ": AAAA HERE D!");
      var transaction = { serviceNode: _serviceNode, properties: {} };
      transaction.properties[_propName] = _propValue;

      if (_data.hasOwnProperty("transactionId")) {
      console.log(this.uName + ": AAAA HERE E!");
         transaction.transactionId = _data.transactionId;
      }

      this.queueTransaction(transaction);
   }
};

Service.prototype.queueTransaction = function(_transaction) {
   _transaction.queued =  _transaction.hasOwnProperty("queued") ? _transaction.queued + 1 : 1;
            console.log(this.uName+": AAAAAA HERE F!");

   if (_transaction.queued > this.queueRetryLimit) {
      console.error(this.uName + ": Unable to queue transaction as it has been requeued too many times");
      return false;
   }

   if (_transaction.hasOwnProperty("transactionId")) {
      this.transactions[_transaction.transactionId] = _transaction;
   }

   this.queue.push(_transaction);
   this.pokeQueue();
   return true;
};

Service.prototype.pokeQueue = function() {

            console.log(this.uName+": AAAAAA HERE G! Queue length="+this.queue.length);
   if (!this.queueTimer && this.queue.length > 0) {

      this.queueTimer = setTimeout( () => {
         console.log(this.uName+": AAAAAA HERE H!");

         if (this.queue.length > 0) {
            var transaction = this.queue.shift();
            console.log(this.uName+": AAAAAA HERE I! transaction=", transaction.properties);
            
            if (transaction.hasOwnProperty("transactionId")) {
               delete this.transactions[transaction.transactionId];
            }

            if (transaction.serviceNode.transactionReadyForProcessing(transaction)) {

               transaction.serviceNode.processTransaction(transaction, (_err, _res) => {

                  if (_err) {
                     console.error(this.uName + ": Unable to process transaction. Error=" + _err);
                  }

                  this.queueTimer = null;
                  this.pokeQueue();
               });
            }
            else {
               this.queueTimer = null;
               this.queueTransaction(transaction);
            }
         }
      }, this.queueQuant);
   }
};

module.exports = exports = Service;
