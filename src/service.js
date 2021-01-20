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

Service.prototype.createNode = function(_config) {
   var type = _config.type;
   _config.propogateToParent = (_config.hasOwnProperty('propogateToParent')) ? _config.propogateToParent : false;
   _config.local = (_config.hasOwnProperty("local")) ? _config.local : this.localThings;

   var ServiceOwnedNode = require("./services/nodes/"+type);
   var thing = new ServiceOwnedNode(_config, this);
   this.gang.casa.refreshSourceListeners();

   return thing;
};

Service.prototype.findOrCreateNode = function(_config) {

   if (this.myNamedObjects.hasOwnProperty(_config.name)) {
      return this.myNamedObjects[_config.name];
   }
   else {
      return this.createNode(_config);
   }
};

Service.prototype.notifyChange = function(_serviceNode, _propName, _propValue, _data) {

   if (_data.hasOwnProperty("transactionId") && this.transactions.hasOwnProperty(_serviceNode.name + "-" + _data.transactionId)) {
      this.transactions[_serviceNode.name + "-" + _data.transactionId].properties[_propName] = _propValue;
   }
   else {
      var transaction = { "action": "propertyChanged", properties: {} };
      transaction.properties[_propName] = _propValue;

      if (_data.hasOwnProperty("transactionId")) {
         transaction.transactionId = _serviceNode.name + "-" + _data.transactionId;
      }

      this.queueTransaction(_serviceNode, transaction);
   }
};

Service.prototype.queueTransaction = function(_serviceNode, _transaction) {
   _transaction.queued =  _transaction.hasOwnProperty("queued") ? _transaction.queued + 1 : 1;

   if (_transaction.queued > this.queueRetryLimit) {
      console.error(this.uName + ": Unable to queue transaction as it has been requeued too many times");
      return false;
   }

   _transaction.serviceNode = _serviceNode;

   if (_transaction.hasOwnProperty("transactionId")) {
      this.transactions[_transaction.transactionId] = _transaction;
   }

   if (!_transaction.hasOwnProperty("callback")) {
      _transaction.callback = function(_err, _res) {

         if (_err) {
            console.error(this.uName + ": Unable to process transaction. Error=" + _err);
         }
      };
   }

   this.queue.push(_transaction);
   this.pokeQueue();
   return true;
};

Service.prototype.pokeQueue = function() {

   if (!this.queueTimer && this.queue.length > 0) {

      this.queueTimer = setTimeout( () => {

         if (this.queue.length > 0) {
            var transaction = this.queue.shift();
            
            if (transaction.hasOwnProperty("transactionId")) {
               delete this.transactions[transaction.transactionId];
            }

            if (transaction.serviceNode.transactionReadyForProcessing(transaction)) {

               setTimeout( (_transaction) => {
                  Object.getPrototypeOf(_transaction.serviceNode)["process" + _transaction.action[0].toUpperCase() + _transaction.action.slice(1)].call(_transaction.serviceNode, _transaction, _transaction.callback);
               }, 0, transaction);

               this.queueTimer = null;
               this.pokeQueue();
            }
            else {
               this.queueTimer = null;
               this.queueTransaction(transaction.serviceNode, transaction);
            }
         }
      }, this.queueQuant);
   }
};

module.exports = exports = Service;
