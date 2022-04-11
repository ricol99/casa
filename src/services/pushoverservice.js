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
   this.pushover = new push( { user: this.userId, token: this.token });
};

module.exports = exports = PushoverService;
