var util = require('util');
var Service = require('../service');
var Pusher = require("pusher-js");

function PusherService(_config, _owner) {
   Service.call(this, _config, _owner);

   this.deviceTypes = {
      "source": "pushersource"
   };

   this.appId = _config.appId;
   this.appKey = _config.appKey;
   this.appSecret = _config.appSecret;
   this.appCluster = _config.appCluster;
}

util.inherits(PusherService, Service);

PusherService.prototype.coldStart = function() {

   try {
      this.pusher = new Pusher(this.appKey, {
        cluster: this.appCluster
      });

   }
   catch (_error) {
      console.error(this.uName + ": Unable to establish Pusher session, appId = " + this.appId + ", error = ", _error);
   }
};

module.exports = exports = PusherService;
