var PeerSocketRequestor = require('./peersocketrequestor');

function PeerSourceCommandProtocol(_config) {
   this.owner = _config.owner;
   this.socket = _config.socket;
   this.incompleteRequests = _config.incompleteRequests || {};
   this.requestPrefix = _config.requestPrefix;
   this.requestor = _config.requestor;
   this.reqId = 0;
}

PeerSourceCommandProtocol.prototype.nextRequestId = function(_kind) {
   var id = this.requestPrefix + ":" + _kind + ":" + this.reqId;
   this.reqId = (this.reqId + 1) % 10000;
   return id;
};

PeerSourceCommandProtocol.prototype.sendSourceTransaction = function(_source, _newTransaction, _data, _callback) {
   return this.sendRequest("set-source-transaction-req", "settrans", {
      sourceName: _source.uName,
      newTransaction: _newTransaction,
      transaction: _data.transaction
   }, _callback);
};

PeerSourceCommandProtocol.prototype.sendSetSourceProperty = function(_source, _propName, _propValue, _data, _callback) {
   return this.sendRequest("set-source-property-req", "changeprop", {
      sourceName: _source.uName,
      property: _propName,
      value: _propValue,
      transaction: _data.transaction
   }, _callback);
};

PeerSourceCommandProtocol.prototype.sendSetSourcePropertyWithRamp = function(_source, _propName, _ramp, _data, _callback) {
   return this.sendRequest("set-source-property-req", "changeprop", {
      sourceName: _source.uName,
      property: _propName,
      ramp: _ramp,
      transaction: _data.transaction
   }, _callback);
};

PeerSourceCommandProtocol.prototype.sendRaiseSourceEvent = function(_source, _eventName, _data, _callback) {
   return this.sendRequest("raise-source-event-req", "raiseevent", {
      sourceName: _source.uName,
      eventName: _eventName,
      transaction: _data.transaction
   }, _callback);
};

PeerSourceCommandProtocol.prototype.sendRequest = function(_message, _kind, _data, _callback) {
   var id = this.nextRequestId(_kind);
   var data = this.requestData(_data, id);
   var callback = _callback ? _callback : function() {};

   this.incompleteRequests[id] = new PeerSocketRequestor({
      requestId: id,
      callback: callback,
      socket: this.socket
   });

   this.incompleteRequests[id].sendRequest({ message: _message, data: data }, (_requestId) => {
      delete this.incompleteRequests[_requestId];
   });

   return true;
};

PeerSourceCommandProtocol.prototype.requestData = function(_data, _requestId) {
   var data = {};

   for (var key in _data) {

      if (_data.hasOwnProperty(key) && (_data[key] !== undefined)) {
         data[key] = _data[key];
      }
   }

   data.requestId = _requestId;
   data.requestor = this.requestor;

   return data;
};

PeerSourceCommandProtocol.prototype.completeResponse = function(_data) {

   if (!_data || (_data.requestor !== this.requestor) || !this.incompleteRequests[_data.requestId]) {
      return false;
   }

   this.incompleteRequests[_data.requestId].completeRequest(_data.result);
   delete this.incompleteRequests[_data.requestId];
   return true;
};

module.exports = exports = PeerSourceCommandProtocol;
