var util = require('util');
var Step = require('./step');
var push = require( 'pushover-notifications' );
var CasaSystem = require('./casasystem');

function Pushover(_config) {
   this.messagePriority = (_config.priority) ? _config.priority : 0;

   var casaSys = CasaSystem.mainInstance();
   this.userGroup = casaSys.findSource(_config.userGroup);

   Step.call(this, _config);

   this.pushService = new push( { user: 'hu7KvA9B2qaD5NvHUL4Fki3MBmnxW7h',
                                  token: 'ac7TcmTptiV3Yrh6MZ93xGQsfxp2mV' });
}

util.inherits(Pushover, Step);

Pushover.prototype.process = function(_value, _data) {

   if (_data.coldStart) {
      return;
   }

   var _title = 'Casa Collin' + ((this.messagePriority > 0) ? ' Alarm' : ' Update');

   var msg = {
      user: this.userGroup.getProperty('pushoverDestAddr'),
      message: _value,    // required
      title: _title, 
      retry: 60,
      expire: 3600,
      priority: this.messagePriority,
   };

   var that = this;

   this.pushService.send(msg, function(_err, _result ) {

      if (_err) {
         console.info('pushoverstep: Error logging into Pushover: ' + _err);
      }
   });

   this.outputForNextStep(_value, _data);
}

module.exports = exports = Pushover;

