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
   this.deviceTypes = util.copy(_config.deviceTypes);
}

util.inherits(Service, Thing);

// Create a service node, if needed
Service.prototype.interestInNewChild = function(_uName) {
   var splitUName = _uName.split(":");

   if (splitUName.length <= 1) {
      return;
   }

   var objName = splitUName[splitUName.length - 1];
   var splitName = objName.split("-");

   if (splitName.length <= 1) {
      return;
   }

   var type = splitName[0];
   var id = splitName[1];

   if (this.deviceTypes && this.deviceTypes.hasOwnProperty(type)) {

      if (!this.myNamedObjects.hasOwnProperty(objName)) {
         var serviceNode = this.createNode({ id: id, type: this.deviceTypes[type], name: objName });
         serviceNode.coldStart();
      }
   }
};

Service.prototype.createNode = function(_config) {
   var type = _config.type;
   _config.propogateToParent = (_config.hasOwnProperty('propogateToParent')) ? _config.propogateToParent : false;
   _config.local = (_config.hasOwnProperty("local")) ? _config.local : this.localThings;

   var ServiceOwnedNode = require("./services/nodes/"+type);
   var thing = new ServiceOwnedNode(_config, this);

   setTimeout( () => {
      this.gang.casa.refreshSourceListeners();
   }, 500);

   return thing;
};

Service.prototype.findOrCreateNode = function(_type, _id) {
   let config = { name: _type + "-" + _id, type: this.deviceTypes[_type], subscription: {} };

   if (this.myNamedObjects.hasOwnProperty(config.name)) {
      return this.myNamedObjects[config.name];
   }
   else {
      return this.createNode(config);
   }
};

Service.prototype.notifyChange = function(_serviceNode, _propName, _propValue, _data, _subscriber) {

   if (_data.hasOwnProperty("transactionId") && this.transactions.hasOwnProperty(_serviceNode.name + "-" + _data.transactionId)) {
      this.transactions[_serviceNode.name + "-" + _data.transactionId].properties[_propName] = _propValue;

      for (var arg in _data) {
         this.transactions[_serviceNode.name + "-" + _data.transactionId].propData[arg] = _data[arg];
      }
   }
   else {
      var transaction = { "action": "propertyChanged", properties: {}, coldStart: _data.hasOwnProperty("coldStart") && _data.coldStart, subscriber: _subscriber };
      transaction.properties[_propName] = _propValue;
      transaction.propData = util.copy(_data);

      if (_data.hasOwnProperty("transactionId")) {
         transaction.transactionId = _serviceNode.name + "-" + _data.transactionId;
      }

      this.queueTransaction(_serviceNode, transaction);
   }
};

Service.prototype.queueTransaction = function(_serviceNode, _transaction) {
   _transaction.queued = _transaction.hasOwnProperty("queued") ? _transaction.queued + 1 : 1;

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
      }.bind(this);
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
               console.log(this.uName + ": Dispatching transaction for processing, " + util.inspect(transaction.properties));

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
