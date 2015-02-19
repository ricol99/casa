var util = require('util');
var events = require('events');

function Activator(_name, _source, _timeout, _invert) {

   if (_name.name) {
      // constructing from object rather than params
      this.name = _name.name;
      this.source = _name.source;
      this.timeout = _name.timeout;
      this.invert = _name.invert;
   }
   else {
      this.name = _name;
      this.source = _source;
      this.timeout = _timeout;
      this.invert = _invert;
   }

   this.coldStart = true;

   this.timeout = _timeout;

   this.destActivated = false;
   this.sourceActive = false;
   this.timeoutObj = null;

   var that = this;

   events.EventEmitter.call(this);

   this.source.on('active', function (sourceName) {
      sourceActive(sourceName);
   });

   this.source.on('activated', function (sourceName) {
      sourceActive(sourceName);
   });

   var sourceActive = function(sourceName) {
      console.log('source ' + sourceName + ' active!');
      
      if (that.coldStart) {
         that.coldStart = false;
         that.destActivated = false;
      }

      that.sourceActive = true;

      if (!that.destActivated) {
         activateDestination();
         if (that.timeout != 0) {
            delayedSwitchOff();
         }
      }
   }

   this.source.on('inactive', function (sourceName) {
      sourceInactive(sourceName);
   });

   this.source.on('deactivated', function (sourceName) {
      sourceInactive(sourceName);
   });

   var sourceInactive = function(sourceName) {
      console.log('source ' + sourceName + ' inactive!');

      if (that.coldStart) {
         that.coldStart = false;
         that.destActivated = true;
      }

      that.sourceActive = false;

      // if destination is activated , restart timer to keep it activated for the timeout after trigger drops
      if (that.destActivated) {

         // destination is activated. If there is a timer, restart it. Else ignore
         if (that.timeout != 0) {
            // clear old timer and restart new one
            clearTimeout(that.timeoutObj);
            delayedSwitchOff();
         }
         else {
	    // else deactivate now as no timer
            deactivateDestination();
         }
      }
   }

   var activateDestination = function() {
      that.destActivated = true;
      that.emit(that.invert ? 'deactivate' : 'activate', that.name); 
   }

   var deactivateDestination = function() {
      that.destActivated = false;
      that.emit(that.invert ? 'activate' : 'deactivate', that.name); 
   }

   var delayedSwitchOff = function() {
      that.timeoutObj = setTimeout(function () {
         if (that.sourceActive) {
            delayedSwitchOff();
         }
         else {  // deactivate destination
            deactivateDestination();
         }
      }, that.timeout*1000);
   }
}

util.inherits(Activator, events.EventEmitter);

module.exports = exports = Activator;
