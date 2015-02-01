var util = require('util');
var events = require('events');

function Activator(_name, _eventSource, _timeout, _invert) {
   var name = 'activator:' + _name;
   var eventSource = _eventSource;
   var timeout = _timeout;
   var invert = _invert;
   var coldStart = true;

   var timeout = _timeout;

   var destActivated = false;
   var sourceActive = false;
   var timeoutObj = null;

   var that = this;

   events.EventEmitter.call(this);

   eventSource.on('active', function (sourceName) {
      console.log('source ' + sourceName + ' active!');
      
      if (coldStart) {
         coldStart = false;
         destActivated = false;
      }

      sourceActive = true;

      if (!destActivated) {
         activateDestination();
         if (timeout != 0) {
            delayedSwitchOff();
         }
      }
   });

   eventSource.on('inactive', function (sourceName) {
      console.log('source ' + sourceName + ' inactive!');

      if (coldStart) {
         coldStart = false;
         destActivated = true;
      }

      sourceActive = false;

      // if destination is activated , restart timer to keep it activated for the timeout after trigger drops
      if (destActivated) {

         // destination is activated. If there is a timer, restart it. Else ignore
         if (timeout != 0) {
            // clear old timer and restart new one
            clearTimeout(timeoutObj);
            delayedSwitchOff();
         }
         else {
	    // else deactivate now as no timer
            deactivateDestination();
         }
      }
   });

   var activateDestination = function() {
      destActivated = true;
      that.emit(invert ? 'deactivate' : 'activate', name); 
   }

   var deactivateDestination = function() {
      destActivated = false;
      that.emit(invert ? 'activate' : 'deactivate', name); 
   }

   var delayedSwitchOff = function() {
      that.timeoutObj = setTimeout(function () {
         if (sourceActive) {
            delayedSwitchOff();
         }
         else {  // deactivate destination
            deactivateDestination();
         }
      }, timeout*1000);
   }
}

util.inherits(Activator, events.EventEmitter);

var create = function(_name, _eventSource, _timeout, _invert) {
   return new Activator(_name, _eventSource, _timeout, _invert);
};

exports.create = create;
exports.Activator = Activator;
