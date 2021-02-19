var util = require('util');
var Service = require('../service');
var Hue = require("node-hue-api");

var push = require( 'pushover-notifications' );

function PushoverService(_config, _owner) {
   _config.queueQuant = 150;
   _config.deviceTypes = { "group": "pushoverservicegroup" };

   Service.call(this, _config, _owner);

   this.userId = _config.userId;
   this.token = _config.token;
}

util.inherits(PushoverService, Service);

PushoverService.prototype.coldStart = function() {
   this.pushover = new push( { user: this.userId, token: this.token });
};

module.exports = exports = PushoverService;
