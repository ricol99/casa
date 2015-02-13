var util = require('util');
var Action = require('./action');
var push = require( 'pushover-notifications' );

function PushoverAction(_name, _activatedMessage, _actPriority, _deactivatedMessage, _deactPriority, _activator, _user) {
   this.activatedMessage = _activatedMessage;
   this.deactivatedMessage = _deactivatedMessage;
   this.messageActPriority = _actPriority;
   this.messageDeactPriority = _deactPriority;

   this.actionActive = false;
   this.pushService = new push( { user: 'hu7KvA9B2qaD5NvHUL4Fki3MBmnxW7h',
                                  token: 'ac7TcmTptiV3Yrh6MZ93xGQsfxp2mV' });

   var that = this;

   Action.call(this, 'pushover:' + _name, _activator, _user);

   this.on('activated', function () {
      console.log(that.name + ': received activated event');

      if (!that.actionActive) {
         that.actionActive = true;
         //that.emit('activated', that.name);

         var msg = {
            user: that.thing.getProperty('pushoverDestAddr'),
            message: that.activatedMessage,   // required
            title: "Casa Update",
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
         //that.emit('deactivated', that.name);

         var msg = {
            user: that.thing.getProperty('pushoverDestAddr'),
            message: that.deactivatedMessage,   // required
            title: "Casa Collin Update",
            retry: 60,
            expire: 3600,
            priority: that.messageDeactPriority,
         };

         that.pushService.send( msg, function( err, result ) {
            if ( err ) {
               console.log('Error logging into Pushover: ' + error);
            }
         });
      }
   });
}

util.inherits(PushoverAction, Action);

module.exports = exports = PushoverAction;

