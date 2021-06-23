var util = require('util');
var Service = require('../service');
var Pusher = require("pusher");

function PusherService(_config, _owner) {
   Service.call(this, _config, _owner);

   this.deviceTypes = {
      "thing": "pusherthing"
   };

   this.appId = _config.appId;
   this.appKey = _config.appKey;
   this.appSecret = _config.appSecret;
   this.appCluster = _config.appCluster;
   this.channelName = _config.hasOwnProperty("gang") ? "casa-"+_config.gang : "casa-"+this.gang.name;
}

util.inherits(PusherService, Service);

PusherService.prototype.coldStart = function() {

   try {
      this.pusher = new Pusher({
         appId: this.appId,
         key: this.appKey,
         secret: this.appSecret,
         cluster: this.appCluster
      });

      this.channel = pusher.subscribe(this.channelName);
   }
   catch (_error) {
      console.error(this.uName + ": Unable to establish Pusher session, appId = " + this.appId);
   }
};

module.exports = exports = PusherService;
