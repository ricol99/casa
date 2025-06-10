var util = require('util');
var Service = require('../service');
var events = require('events');

var express;
var app;
var http;
var io;

function WebService(_config, _owner) {
   Service.call(this, _config, _owner);
   this.secure = _config.hasOwnProperty("secure") ? _config.secure : this.gang.inSecureMode();
   this.socketIoSupported = _config.hasOwnProperty("socketIoSupported") ? _config.socketIoSupported : false;
   this.localHost = _config.hasOwnProperty("localHost") ? _config.localHost : false;
   this.mainServer = _config.hasOwnProperty("mainServer") ? _config.mainServer : false;
   this.hangingOffMainServer = this.mainServer ? false : !this.localHost;
   this.delayStartListening = _config.hasOwnProperty("delayStartListening") ? _config.delayStartListening : false;

   if (_config.hasOwnProperty("mediaRoute")) {
      this.mediaRoute = _config.mediaRoute;
   }

   if (this.secure !== this.gang.inSecureMode()) {
      this.hangingOffMainServer = false;
   }

   if (this.mainServer || (_config.hasOwnProperty("port") && (_config.port != this.gang.mainListeningPort()))) {
      this.hangingOffMainServer = false;
      this.port = _config.port;
   }
   else {
      this.port = (this.hangingOffMainServer) ? this.gang.mainListeningPort() : ((this.secure) ? 443 : 80);
   }

   if (!this.mainServer && (!this.hangingOffMainServer && (this.port === this.gang.mainListeningPort()))) {
      console.error(this.uName + ": Unable to create Webservice due to port clashed with main Server");
      process.exit(2);
   }

   if (this.hangingOffMainServer && this.mediaPath && !this.mediaRoute) {
      console.error(this.uName + ": Unable to create Webservice, using main server due to port clash and no mediaRoute has been defined mediaPath!");
      process.exit(2);
   }

   if (!this.mediaRoute) {
      this.mediaRoute = /^(.+)$/;
   }

   if (_config.hasOwnProperty("mediaPath")) {
      this.mediaPath = _config.mediaPath + "/";
   }

   if (!this.hangingOffMainServer) {
      express = require('express');
      app = express();

      if (this.secure) {
         var fs = require('fs');

         this.serverOptions = {
            key: fs.readFileSync(this.gang.certPath()+'/server.key'),
            cert: fs.readFileSync(this.gang.certPath()+'/server.crt'),
            ca: fs.readFileSync(this.gang.certPath()+'/ca.crt'),
            requestCert: true,
            rejectUnauthorized: true
         };

         http = require('https').Server(serverOptions, app);

         if (this.socketIoSupported)  {
            io = require('socket.io')(http, { allowUpgrades: true });
         }
      }
      else {
         http = require('http').Server(app);
   
         if (this.socketIoSupported)  {
            io = require('socket.io')(http, { allowUpgrades: true, transports: ['websocket'] });
         }
      }
   }
}

util.inherits(WebService, Service);

// Called when current state required
WebService.prototype.export = function(_exportObj) {
   Service.prototype.export.call(this, _exportObj);
};

// Called when current state required
WebService.prototype.import = function(_importObj) {
   Service.prototype.import.call(this, _importObj);
};

WebService.prototype.coldStart = function() {
   this.start();
   Service.prototype.coldStart.call(this);
};

WebService.prototype.hotStart = function() {
   this.start();
   Service.prototype.hotStart.call(this);
};

WebService.prototype.start = function() {

   if (this.hangingOffMainServer) {

      if (this.mediaPath) {

         this.gang.casa.addRouteToMainServer(this.mediaRoute, (req, res) => {
            console.log(this.uName + ": Serving file " + req.params[0]);
            res.sendFile(this.mediaPath + req.params[0]);
         });
      }
   }
   else {

      if (this.mediaPath) {

         app.get(this.mediaRoute, (req, res) => { 
            console.log(this.uName + ": Serving file " + req.params[0]);
            res.sendFile(this.mediaPath + req.params[0]); 
         });
      }

      if (!this.delayStartListening) {
         this.startListening();
      }
   }
};

WebService.prototype.startListening = function() {

   if (this.localHost) {

      http.listen(this.port, 'localhost', () => {
         console.log(this.uName + ': listening on (localhost) *: ' + this.port);
      });
   }
   else {

      http.listen(this.port, () => {
         console.log(this.uName + ': listening on *: ' + this.port);
      });
   }
};

WebService.prototype.addRoute = function(_route, _callback) {
   return (this.hangingOffMainServer) ? this.gang.casa.addRouteToMainServer(_route, _callback) : app.get(_route, _callback);
};

WebService.prototype.addPostRoute = function(_route, _callback) {
   return (this.hangingOffMainServer) ? this.gang.casa.addPostRouteToMainServer(_route, _callback) : app.post(_route, _callback);
};

WebService.prototype.addIoRoute = function(_route, _callback, _transportName) {
   var ret = false;

   if (!this.socketIoSupported) {
      return false;
   }

   if (this.hangingOffMainServer) {
      return this.gang.casa.addIoRouteToMainServer(_route, _callback, _transportName);
   }
   else {

      if (_transportName) {
          ret = this.findIoMessageSocketService().addIoRoute(_route, _transportName, _callback);
      }

      if (!_transportName || (_transportName && ((_transportName === "all") || (_transportName === "http")))) {
         ret = ret || (io.of(_route).on('connection', _callback) != null);
      }
      return ret;
   }
};

WebService.prototype.newIoSocket = function(_address, _route, _secure, _messageTransportName) {
   var httpStr = "http";
   var ioClient = require('socket.io-client');
   var socketOptions = {};
   
   if (!_messageTransportName || _messageTransportName === "http") {

      if (_secure) {
         var fs = require('fs'); 
         httpStr = "https";
         socketOptions = {
            secure: true,
            rejectUnauthorized: false,
            key: fs.readFileSync(this.gang.certPath()+'/client.key'),
            cert: fs.readFileSync(this.gang.certPath()+'/client.crt'), 
            ca: fs.readFileSync(this.gang.certPath()+'/ca.crt')
         };
      }
      else {
         socketOptions = { transports: ['websocket'] };
      }
      socketOptions.forceNew = true;
      socketOptions.reconnection = false;

      console.log(this.uName + ': Attempting to connect to ' + _address.host + ':' + _address.port + _route);
      return ioClient(httpStr + '://' + _address.host + ':' + _address.port + _route, socketOptions);
   }
   else {
      return this.findIoMessageSocketService().newIoSocket(_address, _route, _secure, _messageTransportName);
   }

};

WebService.prototype.findIoMessageSocketService = function() {

   if (this.ioMessageSocketService) {
      return this.ioMessageSocketService;
   }

   var ioMessagesocketServiceName = this.gang.casa.findServiceName("iomessagesocketservice");
   this.ioMessageSocketService = ioMessagesocketServiceName ? this.gang.casa.findService(ioMessagesocketServiceName) : null;
   return this.ioMessageSocketService;
};

module.exports = exports = WebService;
