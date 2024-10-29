var util = require('util');
var Service = require('../service');
var Hue = require("node-hue-api");

var Push = require( 'pushover-notifications' );

function PushoverService(_config, _owner) {
   _config.queueQuant = 150;
   _config.deviceTypes = { "group": "pushoverservicegroup" };
   _config.optimiseTransactions = false;  // Only allow one event and property per transaction

   Service.call(this, _config, _owner);

   this.userId = _config.userId;
   this.token = _config.token;
}

util.inherits(PushoverService, Service);

// Called when current state required
PushoverService.prototype.export = function(_exportObj) {
   Service.prototype.export.call(this, _exportObj);
};

// Called when current state required
PushoverService.prototype.import = function(_importObj) {
   Service.prototype.import.call(this, _importObj);
};

PushoverService.prototype.coldStart = function() {
   this.start();
   Service.prototype.coldStart.call(this);
};

PushoverService.prototype.hotStart = function() {
   this.start();
   Service.prototype.hotStart.call(this);
};

PushoverService.prototype.start = function() {
   this.pushover = new Push( { user: this.userId, token: this.token, onerror: function(_error) { console.error("Pushover received error: "+_error);} });
};

PushoverService.prototype.sendMessage = function(_destinationAddress, _messagePriority, _message, _callback) {
   var title = 'Casa Collin' + ((_messagePriority > 0) ? ' Alarm' : ' Update');

   if (_message !== "") {
      var msg = {
         user: _destinationAddress,
         message: _message,    // required
         title: title,
         retry: 60,
         expire: 3600,
         priority: _messagePriority
      };

      try {
         this.pushover.send(msg, _callback);
      }
      catch (_err) {
         _callback("Error logging into Pushover: " + _err);
      }
   }
   else {
      _callback("Message empty - not sending!");
   }
};


module.exports = exports = PushoverService;
