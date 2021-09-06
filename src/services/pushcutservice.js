var util = require('util');
var Service = require('../service');

function PushcutService(_config, _owner) {
   Service.call(this, _config, _owner);

   this.deviceTypes = {
      "notifier": "pushcutnotifier"
   };

   this.notificationName = _config.hasOwnProperty("notificationName") ? _config.notificationName : "Casa-Notification";
}

util.inherits(PushcutService, Service);

PushcutService.prototype.notifyUser = function(_userOrGroup, _notification, _node) {
   console.log(this.uName + ": AAAAAAA _notification=", _notification);

   var userOrGroup = this.gang.findNamedObject(_userOrGroup);

   if (!userOrGroup) {
      console.error(this.uName + ": User not found: " + userOrGroup);
      return false;
   }

   if (!userOrGroup.hasProperty("pushcut-api-key")) {
      console.error(this.uName + ": No Pushcut API key defined for user " + userOrGroup.name);
      return false;
   }

   var apiKey = userOrGroup.getProperty("pushcut-api-key");
   console.log(this.uName + ": AAAAAA Api Key = ", apiKey);

   try {
      const https = require('https')
      const data = JSON.stringify(_notification);

      const options = {
        hostname: 'api.pushcut.io',
        port: 443,
        path: "/v1/notifications/"+this.notificationName,
        method: 'POST',
        headers: {
          'API-Key': apiKey,
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
      return true;
   }
   catch (_error) {
      console.error(this.uName + ": Unable to publish message on channel "+_channel);
      return false;
   }
};

module.exports = exports = PushcutService;
