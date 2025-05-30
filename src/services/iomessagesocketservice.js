var util = require("../util");
var Service = require("../service");
var AsyncEmitter = require("../asyncemitter");

function IoMessageSocketService(_config, _owner) {
   Service.call(this, _config, _owner);
   this.setMaxListeners(0);
   this.state = "idle";
   this.messageTransports = {};
}

util.inherits(IoMessageSocketService, Service);

IoMessageSocketService.prototype.createSocket = function(_messageTransport) {
   let newSocket =  new IoMessageSocket(this, _messageTransport);
   return newSocket;
};

IoMessageSocketService.prototype.deleteSocket = function(_socket) {
   _socket.getMessageTransport().deleteSocket(_socket);
};

IoMessageSocketService.prototype.addMessageTransport = function(_transportName, _transport) {

   if (this.messageTransports.hasOwnProperty(_transportName)) {
      console.error(this.uName + ": Configuration error: Conflict between registering transports. Transport name=" + _transportName);
   }

   this.messageTransports[_transportName] = new IoMessageTransport(this, _transportName, _transport);
};

IoMessageSocketService.prototype.addIoRoute = function(_route, _transportName, _callback) {

   if (!this.messageTransports.hasOwnProperty(_transportName)) {
      console.error(this.uName + ": Unable to add IO route, tranport=" + _transportName + " not found!");
      return false;
   }

   return this.messageTransports[_transportName].addIoRoute(_route, _callback);
};

IoMessageSocketService.prototype.of = function(_route, _transportName) {
   return this.addIoRoute(route, _transportName) ? this.messageTransports[_transportName].getRoute(_route) : null;
};

function IoMessageSocket(_owner, _messageTransport) {
   AsyncEmitter.call(this);

   this.owner = _owner;
   this.messageTransport = _messageTransport;
   this.route = "";
   this.serverSocket = false;
   this.id = this.messageTransport.getName() + "/" + this.route + ":" + Date.now();
   this.connectConfig = {};
};

util.inherits(IoMessageSocket, AsyncEmitter);

IoMessageSocket.prototype.getId = function() {
   return this.id;
};

IoMessageSocket.prototype.getMessageTransport = function() {
   return this.messageTransport;
};

IoMessageSocket.prototype.getRoute = function() {
   return this.route;
};

IoMessageSocket.prototype.serverRole = function(_data) {

   if (this.state === "idle") {
      this.error(this.uName + ": Asked to serve socket when no idle!");
      return;
   }

   this.serverSocket = true;
   this.id = _data.id;
   this.peerAddress = _data.peerAddress;
   this.destddress = this.owner.gang.casa.uName;
   this.processConnectConfig(_data.messageData.config);
   this.state = "connecting";
   this.route = _data.route;
   this.messageTransport.addSocket(this, this.route);
   this.sendConnectResponse(true, null);
};

IoMessageSocket.prototype.processConnectConfig = function(_config) {
   var config = _config ? _config : {};
   this.connectConfig.connectingTimeout = config.hasOwnProperty("connectingTimeout") ? config.connectingTimeout : 10;
   this.connectConfig.disconnectingTimeout = config.hasOwnProperty("disconnectingTimeout") ? config.disconnectingTimeout : 10;
   this.connectConfig.heartbeat = config.hasOwnProperty("heartbeat") ? config.heartbeat : 60;
};

IoMessageSocket.prototype.sendMessageOnTransport = function(_message, _data) {
   let data = { id: this.id, route: this.route, peerAddress: this.peerAddress, destAddress: this.destAddress, messageData: _data };
   this.messageTransport.sendMessage(_message, data);
};

IoMessageSocket.prototype.connect = function(_peerAddress, _config) {

   if (this.state === "idle") {
      this.serverSocket = false;
      this.destAddress = _peerAddress;
      this.peerAddress = this.owner.gang.casa.uName;
      this.processConnectConfig(_config);
      this.sendMessageOnTransport("connect", { config: this.connectConfig });
      this.state = "connecting";

      this.connectingTimeout = util.setTimeout( () => {
         this.connectingTimeout = null;
         this.error("Connection timed out!");
      }, this.connectConfig.connectingTimeout * 1000);
   }
   else {
      this.error("Connection already in progress");
   }
};

IoMessageSocket.prototype.sendConnectResponse = function(_accept, _data) {

   if (this.state !== "connecting") {
      this.error("Tried to send connect response in wrong state!");
      return;
   }

   this.sendMessageOnTransport("connect-response", { accept: _accept });
   this.state = "connected";
   this.startHeartbeats();
   this.resetHeartbeatWatchdog();
};

IoMessageSocket.prototype.error = function(_error) {
   console.error(this.id + "Socket error=" + _error);

   if ((this.state === "connecting") || (this.state === "connected")) {
      this.sendMessageOnTransport("error", { error: _error });
      this.clearHeartbeatTimeouts();
   }

   this.asyncEmit("error", { error: "Connection timed out!" });
   this.state = "idle";
   this.clearConnectingTimeout();
   this.clearDisconnectingTimeout();
   this.owner.deleteSocket(this);
};

IoMessageSocket.prototype.clearConnectingTimeout = function() {

   if (this.connectingTimeout) {
      util.clearTimeout(this.connectingTimeout);
   }
};

IoMessageSocket.prototype.clearDisconnectingTimeout = function() {

   if (this.disconnectingTimeout) {
      util.clearTimeout(this.disconnectingTimeout);
   }
};

IoMessageSocket.prototype.clearHeartbeatTimeouts = function() {

   if (this.heartbeatWatchdogTimeout) {
      util.clearTimeout(this.heartbeatWatchdogTimeout);
   }

   if (this.sendHeartbeatTimeout) {
      util.clearTimeout(this.sendHeartbeatTimeout);
   }
};

IoMessageSocket.prototype.disconnect = function() {

   if (this.state === "connected") {
      this.clearHeartbeatTimeouts();
      this.sendMessageOnTransport("disconnect", {});
      this.state = "disconnecting";

      this.disconnectingTimeout = util.setTimeout( () => {
         this.disconnectingTimeout = null;
         this.error("Disconnection timed out!");
      }, this.connectConfig.disconnectingTimeout * 1000);
   }
   else {
      this.error("Connection already in progress!");
   }
};

IoMessageSocket.prototype.emit = function(_message, _data) {

   if (this.state !== "connected") {
      console.error(this.id + ": Client tried to send message outside of connected socket! Message="+_message);
      return;
   }

   this.sendMessageOnTransport(_message, _data);
};

IoMessageSocket.prototype.startHeartbeats = function() {

   if ((this.connectConfig.heartbeat > 0) && !this.sendHeartbeat) {
      this.sendMessageOnTransport('heartbeat', {});

      this.sendHeartbeatTimeout = util.setTimeout( () => {
         this.sendHeartbeatTimeout = null;
         this.startHeartbeats();
      }, this.connectConfig.heartbeat * 1000);
   }
};

IoMessageSocket.prototype.resetHeartbeatWatchdog = function() {

   if (this.heartbeatWatchdogTimeout) {
      util.clearTimeout(this.heartbeatWatchdogTimeout);
   }

   if (this.connectConfig.heartbeat > 0) {

      this.heartbeatWatchdogTimeout = util.setTimeout( () => {
         this.error("Connection heartbeat lost!");
      }, this.connectConfig.heartbeat * 1000 * 1.5);
   }
};

IoMessageSocket.prototype.receivedConnectRespFromTransport = function(_data) {

   if (this.state !== "connecting") {
      this.error("Received connection response when not in connecting state!");
      return;
   }

   if (!_data || !_data.hasOwnProperty("accept")) {
      this.error("Received invalid connection response!");
      return;
   }

   if (_data.accept) {
      this.state = "connected";
      this.clearConnectingTimeout();
      this.startHeartbeats();
      this.resetHeartbeatWatchdog();
      this.asyncEmit("connected", {});
   }
   else {
      this.state = "idle";
      this.error(_data.hasOwnProperty("reason") ? "Connection refused by peer. Reason=" + _data.reason : "Connection refused by peer");
   }
};

IoMessageSocket.prototype.receivedDisconnectFromTransport = function(_data) {

   if (this.state !== "connected") {
      this.error("Received disconnect when not connected!");
      return;
   }

   this.clearHeartbeatTimeouts();
   this.asyncEmit("disconnect");
   this.sendMessageOnTransport("disconnect-response", {});
   this.state = "idle";
};

IoMessageSocket.prototype.receivedDisconnectRespFromTransport = function(_data) {

   if (this.state !== "disconnect") {
      this.error("Received disconnect response when not disconnecting!");
      return;
   }

   util.clearTimeout(this.disconnectingTimeout)
   this.state = "idle";
};

IoMessageSocket.prototype.receivedErrorFromTransport = function(_data) {

   if (this.state !== "idle") {
      this.state = "idle";
      let err = _data.hasOwnProperty("error") ? _data.error : "Unspecified reason";
      this.error("error", { error: "Transport Error: " + err });
   }
};

IoMessageSocket.prototype.receivedHeartbeatFromTransport = function(_data) {

   if (this.state === "connected") {
      this.resetHeartbeatWatchdog();
   }
};

IoMessageSocket.prototype.receivedMessageFromTransport = function(_data) {

   if (this.state !== "connected") {
      console.error(this.id + ": Message received outside of connected socket! Message="+_data.name);
      return;
   }

   if (!_data || (!((_data.hasOwnProperty("name") && _data.hasOwnProperty("data"))))) {
      console.error(this.id + ": Received invalid message from transport!");
      return;
   }

   this.asyncEmit(_data.name, util.copy(_data.data, true));
};

function IoMessageTransport(_owner, _transportName, _transport) {
   this.owner = _owner;
   this.name = _transportName;
   this.transport = _transport;
   this.routes = {};
   this.sockets = {};

   this.transportReceivedConnectHandler = IoMessageTransport.prototype.newConnection.bind(this);
   this.transportReceivedConnectRespHandler = IoMessageTransport.prototype.receivedConnectRespFromTransportCb.bind(this);
   this.transportReceivedDisconnectHandler = IoMessageTransport.prototype.receivedDisconnectFromTransportCb.bind(this);
   this.transportReceivedDisconnectRespHandler = IoMessageTransport.prototype.receivedDisconnectRespFromTransportCb.bind(this);
   this.transportReceivedMessageHandler = IoMessageTransport.prototype.receivedMessageFromTransportCb.bind(this);
   this.transportErrorHandler = IoMessageTransport.prototype.receivedErrorFromTransportCb.bind(this);
   this.transportHeartbeatHandler = IoMessageTransport.prototype.receivedHeartbeatFromTransportCb.bind(this);

   this.transport.on("connect", this.transportReceivedConnectHandler);
   this.transport.on("connect-response", this.transportReceivedConnectRespHandler);
   this.transport.on("disconnect", this.transportReceivedDisconnectHandler);
   this.transport.on("disconnect-response", this.transportReceivedDisconnectRespHandler);
   this.transport.on("message", this.transportReceivedMessageHandler);
   this.transport.on("error", this.transportErrorHandler);
   this.transport.on("heartbeat", this.transportHeartbeatHandler);
};

IoMessageTransport.prototype.getName = function() {
   return this.name;
};

IoMessageTransport.prototype.addIoRoute = function(_route, _callback) {
   this.routes[_route] = new IoRoute(_route, this, _callback);
   return true;
};

IoMessageTransport.prototype.newConnection = function(_data) {
   console.log(this.owner.uName+":"+this.name+": newConnection() from ", _data.peerAddress);

   if (!_data || !_data.hasOwnProperty("peerAddress") || !_data.hasOwnProperty("route")) {
      console.error(this.owner.uName+":"+this.name + ": Received invalid connection request!");
      return;
   }

   if (this.routes.hasOwnProperty(_data.route)) {
      let newSocket = this.owner.createSocket(this);
      newSocket.serverRole(_data);
      this.routes[_data.route].serveClient(newSocket, _data);
   }
   else {
      console.error(this.owner.uName+":"+this.name + ": Received newConnection on unregistered route, route=" + _data.route);
   }
};

IoMessageTransport.prototype.sendMessage = function(_message, _data) {
   this.transport.sendMessage(_message, _data);
};

IoMessageTransport.prototype.receivedConnectRespFromTransportCb = function(_data) {

   if (_data.hasOwnProperty("id") && this.sockets[_data.id]) {
      this.sockets[_data.id].receivedConnectRespFromTransport(_data);
   }
};

IoMessageTransport.prototype.receivedDisconnectFromTransportCb = function(_data) {

   if (_data.hasOwnProperty("id") && this.sockets[_data.id]) {
      this.sockets[_data.id].receivedDisconnectRespFromTransport(_data);
   }
};

IoMessageTransport.prototype.receivedDisconnectRespFromTransportCb = function(_data) {

   if (_data.hasOwnProperty("id") && this.sockets[_data.id]) {
      this.sockets[_data.id].receivedDisconnectRespFromTransport(_data);
   }
};

IoMessageTransport.prototype.receivedMessageFromTransportCb = function(_data) {

   if (_data.hasOwnProperty("id") && this.sockets[_data.id]) {
      this.sockets[_data.id].receivedMessageFromTransport(_data);
   }
};

IoMessageTransport.prototype.receivedErrorFromTransportCb = function(_data) {

   if (_data.hasOwnProperty("id") && this.sockets[_data.id]) {
      this.sockets[_data.id].receivedErrorFromTransport(_data);
   }
};

IoMessageTransport.prototype.receivedHeartbeatFromTransportCb = function(_data) {

   if (_data.hasOwnProperty("id") && this.sockets[_data.id]) {
      this.sockets[_data.id].receivedHeartbeatFromTransport(_data);
   }
};

IoMessageTransport.prototype.getRoute = function(_route) {
   return this.routes[_route];
};

IoMessageTransport.prototype.addSocket = function(_socket, _route) {
   this.sockets[_socket.getId()] = _socket;
};

IoMessageTransport.prototype.deleteSocket = function(_socket, _route) {
   delete this.sockets[_socket.getId()];
};

function IoRoute(_routeName, _transport, _callback) {
   AsyncEmitter.call(this);
   this.name = _routeName;
   this.transport = _transport;
   this.callback = _callback;
   this.callbackQueue = [];
   this.callbackTimer = null;
}

util.inherits(IoRoute, AsyncEmitter);

IoRoute.prototype.serveClient = function(_socket, _data) {

   if (this.callback) {
      this.callbackQueue.push(_socket);
      this.executeCallback();
   }

   this.asyncEmit("connection", _socket);
};

IoRoute.prototype.executeCallback = function() {

   if (!this.callbackTimer) {

      this.callbackTimer = util.setTimeout( () => {
         this.callbackTimer = null;
         let socket = this.callbackQueue.shift();
         this.callback(socket);

         if (this.callbackQueue.length >= 1) {
            this.executeCallback();
         }
      }, 0);
   }
};

module.exports = exports = IoMessageSocketService;
