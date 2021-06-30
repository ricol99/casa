var util = require('util');
var Service = require('../service');
var events = require('events');
var express = require('express');
var app = express();

function WebService(_config, _owner) {
   Service.call(this, _config, _owner);
   this.secure = _config.hasOwnProperty("secure") ? _config.secure : this.gang.inSecureMode();
   this.socketIoSupported = _config.hasOwnProperty("socketIoSupported") ? _config.socketIoSupported : false;
   this.localHost = _config.hasOwnProperty("localHost") ? _config.localHost : false;
   this.hangingOffMainServer = !this.localHost;

   if (_config.hasOwnProperty("mediaRoute")) {
      this.mediaRoute = _config.mediaRoute;
   }

   if (this.secure !== this.gang.inSecureMode()) {
      this.hangingOffMainServer = false;
   }

   if (_config.hasOwnProperty("port") && (_config.port != this.gang.mainListeningPort())) {
      this.hangingOffMainServer = false;
      this.port = _config.port;
   }
   else {
      this.port = (this.hangingOffMainServer) ? this.gang.mainListeningPort() : ((this.secure) ? 443 : 80);
   }

   if (!this.hangingOffMainServer && (this.port === this.gang.mainListeningPort())) {
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

      if (this.secure) {
         var fs = require('fs');

         this.serverOptions = {
            key: fs.readFileSync(this.gang.certPath()+'/client.key'),
            cert: fs.readFileSync(this.gang.certPath()+'/client.crt'),
            ca: fs.readFileSync(this.gang.certPath()+'/ca.crt'),
            requestCert: true,
            rejectUnauthorized: true
         };
      }

      if (this.socketIoSuported)  {

         if (this.secure) {
            this.io = require('socket.io')(this.http, { allowUpgrades: true });
         }
         else {
            this.io = require('socket.io')(this.http, { allowUpgrades: true, transports: ['websocket'] });
         }
      }
   }
}

util.inherits(WebService, Service);

WebService.prototype.coldStart = function() {

   if (this.hangingOffMainServer) {

      if (this.mediaPath) {

         this.gang.casa.addRouteToMainServer(this.mediaRoute, (req, res) => {
            console.log(this.uName + ": Serving file " + req.params[0]);
            res.sendFile(this.mediaPath + req.params[0]);
         });
      }
   }
   else {
      var http;

      if (this.secure) {
         this.http = require('https').Server(this.serverOptions, app);
      }
      else {
         this.http = require('http').Server(app);
      }

      if (this.mediaPath) {

         app.get(this.mediaRoute, (req, res) => { 
            console.log(this.uName + ": Serving file " + req.params[0]);
            res.sendFile(this.mediaPath + req.params[0]); 
         });
      }

      if (this.localHost) {

         this.http.listen(this.port, 'localhost', () => {
            console.log(this.uName + ': listening on (localhost) *: ' + this.port);
         });
      }
      else {

         this.http.listen(this.port, () => {
            console.log(this.uName + ': listening on *: ' + this.port);
         });
      }
   }
};

WebService.prototype.addRoute = function(_route, _callback) {
   return (this.hangingOffMainServer) ? this.gang.casa.addRouteToMainServer(_route, _callback) : app.get(_route, _callback);
};

WebService.prototype.addIoRoute = function(_route, _callback) {

   if (!this.socketIoSupported) {
      return false;
   }

   return (this.hangingOffMainServer) ? this.gang.casa.addIoRouteToMainServer(_route, _callback) : this.io.of(_route).on('connection', _callback);
};

module.exports = exports = WebService;
