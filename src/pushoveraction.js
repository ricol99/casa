var util = require('util');
var Action = require('./action');
var push = require( 'pushover-notifications' );

function PushoverAction(_config) {

   this.activatedMessage = _config.activeMessage;
   this.deactivatedMessage = _config.inactiveMessage;
   this.messageActPriority = (_config.activeMessagePriority) ? _config.activeMessagePriority : 0;
   this.messageDeactPriority = (_config.inactiveMessagePriority) ? _config.inactiveMessagePriority : 0;

   Action.call(this, _config);

   this.actionActive = false;
   this.pushService = new push( { user: 'hu7KvA9B2qaD5NvHUL4Fki3MBmnxW7h',
                                  token: 'ac7TcmTptiV3Yrh6MZ93xGQsfxp2mV' });

   var that = this;

   this.on('activated', function () {
      console.log(that.name + ': received activated event');

      if (!that.actionActive) {
         that.actionActive = true;

         var _title = 'Casa Collin' + ((that.messageActPriority > 0) ? ' Alarm' : ' Update');

         var msg = {
            user: that.target.getProperty('pushoverDestAddr'),
            message: that.activatedMessage,    // required
            title: _title, 
            retry: 60,
            expire: 3600,
            priority: that.messageActPriority,
         };

         that.pushService.send( msg, function( err, result ) {
            if ( err ) {
               console.log('Error logging into Pushover: ' + err);
            }
         });
      }
   });

   this.on('deactivated', function () {
      console.log(that.name + ': received deactivated event');

      if (that.actionActive) {
         that.actionActive = false;

         var _title = 'Casa Collin' + ((that.messageDeactPriority > 0) ? ' Alarm' : ' Update');

         var msg = {
            user: that.target.getProperty('pushoverDestAddr'),
            message: that.deactivatedMessage,   // required
            title: _title,
            retry: 60,
            expire: 3600,
            priority: that.messageDeactPriority,
         };

         that.pushService.send( msg, function( err, result ) {
            if ( err ) {
               console.log('Error logging into Pushover: ' + err);
            }
         });
      }
   });
}

util.inherits(PushoverAction, Action);

module.exports = exports = PushoverAction;

