function PeerSourceSubscriptionProtocol(_config) {
   this.owner = _config.owner;
   this.socket = _config.socket;
}

PeerSourceSubscriptionProtocol.prototype.subscribeSource = function(_sourceName, _config) {
   this.socket.emit("subscribe-source", this.subscriptionData(_sourceName, _config));
};

PeerSourceSubscriptionProtocol.prototype.unsubscribeSource = function(_sourceName, _config) {
   this.socket.emit("unsubscribe-source", this.subscriptionData(_sourceName, _config));
};

PeerSourceSubscriptionProtocol.prototype.subscriptionData = function(_sourceName, _config) {
   var config = _config ? _config : {};
   var data = {
      sourceName: _sourceName
   };

   if (config.property) {
      data.property = config.property;
   }

   if (config.event) {
      data.event = config.event;
   }

   if (config.subscription) {
      data.subscription = config.subscription;
   }

   return data;
};

PeerSourceSubscriptionProtocol.prototype.publishSourcePropertyChanged = function(_data) {
   this.socket.emit("source-property-changed", _data);
};

PeerSourceSubscriptionProtocol.prototype.publishSourceEventRaised = function(_data) {
   this.socket.emit("source-event-raised", _data);
};

PeerSourceSubscriptionProtocol.prototype.publishSourceInvalid = function(_data) {
   this.socket.emit("source-invalid", _data);
};

module.exports = exports = PeerSourceSubscriptionProtocol;
