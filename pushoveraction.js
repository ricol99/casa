var util = require('util');
var Action = require('./action');
var push = require( 'pushover-notifications' );

function PushoverAction(_name, _activatedMessage, _deactivatedMessage, _priority, _activator, _user) {
   this.activatedMessage = _activatedMessage;
   this.deactivatedMessage = _deactivatedMessage;
   this.messagePriority = _priority;

   this.actionActive = false;

   var that = this;

   Action.call(this, 'pushover:' + _name, _activator, _user);

   this.activator.on('activate', function () {
      console.log(that.name + ': received activate event');

      if (!that.actionActive) {
         that.actionActive = true;
         that.emit('activated', that.name);

         var pushService = new push( { user: 'hu7KvA9B2qaD5NvHUL4Fki3MBmnxW7h',
                                       token: 'ac7TcmTptiV3Yrh6MZ93xGQsfxp2mV' }
         );

         var msg = {
            //user: 'g7KTUJvsJbPUNH5SL8oEitXBBuL32j',
            user: that.thing.getProperty('pushoverDestAddr'),
            message: that.activatedMessage,   // required
            title: "Casa Collin Update",
            retry: 60,
            expire: 3600,
            priority: that.messagePriority,
         };

         pushService.send( msg, function( err, result ) {
            if ( err ) {
               console.log('Error logging into Pushover: ' + error);
            }
            pushService = null;
         });
      }
   });

   this.activator.on('deactivate', function () {
      console.log(that.name + ': received deactivate event');

      if (that.actionActive) {
         that.actionActive = false;
         that.emit('deactivated', that.name);

         var pushService = new push( { user: 'hu7KvA9B2qaD5NvHUL4Fki3MBmnxW7h',
                                       token: 'ac7TcmTptiV3Yrh6MZ93xGQsfxp2mV' }
         );

         var msg = {
            //user: 'g7KTUJvsJbPUNH5SL8oEitXBBuL32j',
            user: that.thing.getProperty('pushoverDestAddr'),
            message: that.deactivatedMessage,   // required
            title: "Casa Collin Update",
            retry: 60,
            expire: 3600,
            priority: that.messagePriority,
         };

         pushService.send( msg, function( err, result ) {
            if ( err ) {
               console.log('Error logging into Pushover: ' + error);
            }
            pushService = null;
         });
      }
   });
}

util.inherits(PushoverAction, Action);

module.exports = exports = PushoverAction;

