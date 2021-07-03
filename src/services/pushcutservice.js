var util = require('util');
var Service = require('../service');

function PushcutService(_config, _owner) {
   Service.call(this, _config, _owner);

   this.deviceTypes = {
      "notifier": "pushcutnotifier"
   };

   this.secret = _config.secret;
   this.notificationName = _config.hasOwnProperty("notificationName") ? _config.notificationName : "Casa-Notification";
   this.user = this.gang.findNamedObject(_config.user.uName);
}

util.inherits(PushcutService, Service);

PushcutService.prototype.notifyUser = function(_notification, _node) {

   try {
      const https = require('https')
      const data = JSON.stringify(_notification);

      const options = {
        hostname: 'api.pushcut.io',
        port: 443,
        path: '/'+this.secret+"/notifications/"+this.notificationName,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length
        }
      }

      const req = https.request(options, res => {
        console.log(this.uName + ": Pushcut notification completed with " + `statusCode: ${res.statusCode}`);
      })

      req.on('error', (_error) => {
        console.error(this.uName + ": Error trying to create pushcut notification. Error: ", _error);
      })

      req.write(data);
      req.end();
   }
   catch (_error) {
      console.error(this.uName + ": Unable to publish message on channel "+_channel);
   }
};

module.exports = exports = PushcutService;
