function PeerSocketSession(_config) {
   this.owner = _config.owner;
   this.socket = _config.socket || null;
   this.connected = false;
   this.listenersSetUp = false;
   this.lastHeartbeat = Date.now();
   this.heartbeatIntervalMs = _config.hasOwnProperty("heartbeatIntervalMs") ? _config.heartbeatIntervalMs : 60000;
   this.heartbeatTimeoutMs = _config.hasOwnProperty("heartbeatTimeoutMs") ? _config.heartbeatTimeoutMs : 120000;
   this.intervalId = null;
   this.handlers = {};
}

PeerSocketSession.prototype.setSocket = function(_socket) {
   this.socket = _socket;
};

PeerSocketSession.prototype.addHandler = function(_eventName, _handler) {
   this.handlers[_eventName] = _handler;

   if (this.socket && this.listenersSetUp) {
      this.socket.on(_eventName, _handler);
   }
};

PeerSocketSession.prototype.establishListeners = function() {

   if (this.listenersSetUp || !this.socket) {
      return;
   }

   for (var eventName in this.handlers) {

      if (this.handlers.hasOwnProperty(eventName)) {
         this.socket.on(eventName, this.handlers[eventName]);
      }
   }

   this.listenersSetUp = true;
};

PeerSocketSession.prototype.removeListeners = function() {

   if (!this.listenersSetUp || !this.socket) {
      return;
   }

   for (var eventName in this.handlers) {

      if (this.handlers.hasOwnProperty(eventName)) {
         this.socket.removeListener(eventName, this.handlers[eventName]);
      }
   }

   this.listenersSetUp = false;
};

PeerSocketSession.prototype.sendMessage = function(_message, _data) {
   this.socket.emit(_message, _data);
};

PeerSocketSession.prototype.establishHeartbeat = function(_heartbeatDataFunc, _timeoutFunc) {
   this.lastHeartbeat = Date.now();

   if (!this.intervalId) {
      this.intervalId = setInterval( () => {

         if (this.connected) {

            if ((Date.now() - this.lastHeartbeat) > this.heartbeatTimeoutMs) {
               _timeoutFunc();
            }
            else {
               this.sendMessage("heartbeat", _heartbeatDataFunc());
            }
         }
      }, this.heartbeatIntervalMs);
   }
};

PeerSocketSession.prototype.receivedHeartbeat = function() {
   this.lastHeartbeat = Date.now();
};

PeerSocketSession.prototype.stopHeartbeat = function() {

   if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
   }
};

module.exports = exports = PeerSocketSession;
