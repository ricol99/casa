var util = require('util');
var Service = require('../service');
var push = require( 'pushover-notifications' );

function PushoverService(_config) {
   Service.call(this, _config);

   this.userId = _config.userId;
   this.token = _config.token;
}

util.inherits(PushoverService, Service);

PushoverService.prototype.coldStart = function() {
   this.pushService = new push( { user: this.userId, token: this.token });
};

PushoverService.prototype.sendMessage = function(_user, _messagePriority, _message) {
   var _title = 'Casa Collin' + ((_messagePriority > 0) ? ' Alarm' : ' Update');

   var msg = {
      user: _user,
      message: _message,    // required
      title: _title,
      retry: 60,
      expire: 3600,
      priority: _messagePriority,
   };

   var that = this;

   this.pushService.send(msg, function(_err, _result ) {

      if (_err) {
         console.info('pushoverservice: Error logging into Pushover: ' + _err);
      }
   });
};

module.exports = exports = PushoverService;