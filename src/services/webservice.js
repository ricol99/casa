var util = require('util');
var Service = require('../service');
var events = require('events');
var express = require('express');
var app = express();

function WebService(_config) {
   Service.call(this, _config);

   this.secure = _config.secure;
   this.port = _config.hasOwnProperty("port") ? _config.port : ((this.secure) ? 443 : 80);
   this.mediaPath = (_config.hasOwnProperty("mediaPath") ? _config.mediaPath : "/web/media") + "/";

   if (this.secure) {
      this.certDir = _config.certDir;
      var fs = require('fs');

      this.serverOptions = {
         key: fs.readFileSync(this.certDir+'/'+_config.serverKey),
         cert: fs.readFileSync(this.certDir+'/'+_config.serverCert),
         ca: fs.readFileSync(this.certDir+'/'+_config.caCert),
         requestCert: true,
         rejectUnauthorized: true
      };
   }
}

util.inherits(WebService, Service);

WebService.prototype.coldStart = function() {
   var http;

   if (this.secure) {
      http = require('https').Server(this.serverOptions, app);
   }
   else {
      http = require('http').Server(app);
   }

   app.get(/^(.+)$/, (req, res) => { 
      console.log(this.uName + ": Serving file " + req.params[0]);
      res.sendFile(this.mediaPath + req.params[0]); 
   });

   http.listen(this.port, () => {
      console.log(this.uName + ': listening on *: ' + this.port);
   });
};

module.exports = exports = WebService;
