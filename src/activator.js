var util = require('util');
var events = require('events');
var CasaSystem = require('./casasystem');

function Activator(_name, _source, _timeout, _invert) {

   this.source = null;
   this.name = null;
   this.timeout = 0;
   this.invert = false;

   if (_name.name) {
      // constructing from object rather than params
      var casaSys = CasaSystem.mainInstance();
      this.source = casaSys.findSource(_name.source);
      this.name = _name.name;
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
      that.sourceIsActive(sourceName);
   });

   this.source.on('activated', function (sourceName) {
      that.sourceIsActive(sourceName);
   });

   this.source.on('inactive', function (sourceName) {
      that.sourceIsInactive(sourceName);
   });

   this.source.on('deactivated', function (sourceName) {
      that.sourceIsInactive(sourceName);
   });

}

util.inherits(Activator, events.EventEmitter);

Activator.prototype.sourceIsActive = function(sourceName) {
   console.log('source ' + sourceName + ' active!');
   
   if (this.coldStart) {
      this.coldStart = false;
      this.destActivated = false;
   }

   this.sourceActive = true;

   if (!this.destActivated) {
      this.activateDestination();
      if (this.timeout != 0) {
         this.delayedSwitchOff();
      }
   }
}

Activator.prototype.sourceIsInactive = function(sourceName) {
   console.log('source ' + sourceName + ' inactive!');

   if (this.coldStart) {
      this.coldStart = false;
      this.destActivated = true;
   }

   this.sourceActive = false;

   // if destination is activated , restart timer to keep it activated for the timeout after trigger drops
   if (this.destActivated) {

      // destination is activated. If there is a timer, restart it. Else ignore
      if (this.timeout != 0) {
         // clear old timer and restart new one
         this.clearTimeout(this.timeoutObj);
         this.delayedSwitchOff();
      }
      else {
         // else deactivate now as no timer
         this.deactivateDestination();
      }
   }
}

Activator.prototype.activateDestination = function() {
   this.destActivated = true;
   this.emit(that.invert ? 'deactivate' : 'activate', this.name); 
}

Activator.prototype.deactivateDestination = function() {
   this.destActivated = false;
   this.emit(that.invert ? 'activate' : 'deactivate', this.name); 
}

Activator.prototype.delayedSwitchOff = function() {
   var that = this;

   this.timeoutObj = setTimeout(function () {
      if (that.sourceActive) {
         that.delayedSwitchOff();
      }
      else {  // deactivate destination
         that.deactivateDestination();
      }
   }, this.timeout*1000);
}

module.exports = exports = Activator;
