var util = require('util');
var Action = require('./action');
var push = require( 'pushover-notifications' );
var CasaSystem = require('./casasystem');

function PushoverAction(_name, _activatedMessage, _actPriority, _deactivatedMessage, _deactPriority, _activator, _user) {

   this.activatedMessage = null;
   this.deactivatedMessage = null;
   this.messageActPriority = 0;
   this.messageDeactPriority = 0;

   if (_name.name) {
      // constructing from object rather than params
      // Resolve source and target
      var casaSys = CasaSystem.mainInstance();
      var source = casaSys.findSource(_name.source);
      var target = (_name.target) ? casaSys.resolveObject(_name.target) : null;

      this.activatedMessage = _name.activeMessage;
      this.deactivatedMessage = _name.inactiveMessage;
      this.messageActPriority = _name.activeMessagePriority;
      this.messageDeactPriority = _name.inactiveMessagePriority;
      Action.call(this, _name.name, source, target);
   }
   else {
      this.activatedMessage = _activatedMessage;
      this.deactivatedMessage = _deactivatedMessage;
      this.messageActPriority = _actPriority;
      this.messageDeactPriority = _deactPriority;
      Action.call(this, _name, _activator, _user);
   }


   this.actionActive = false;
   this.pushService = new push( { user: 'hu7KvA9B2qaD5NvHUL4Fki3MBmnxW7h',
                                  token: 'ac7TcmTptiV3Yrh6MZ93xGQsfxp2mV' });

   var that = this;


   this.on('activated', function () {
      console.log(that.name + ': received activated event');

      if (!that.actionActive) {
         that.actionActive = true;
         //that.emit('activated', that.name);

         var msg = {
            user: that.thing.getProperty('pushoverDestAddr'),
            message: that.activatedMessage,    // required
            title: 'Casa Collin' + (that.messageActPriority > 0) ? ' Alarm' : ' Update', 
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
            title: 'Casa Collin' + (that.messageDeactPriority > 0) ? ' Alarm' : ' Update',
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

