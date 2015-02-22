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

      if (_name.timeout) {
         this.timeout = _name.timeout;
      }

      if (_name.invert) {
         this.invert = _name.invert;
      }
   }
   else {
      this.name = _name;
      this.source = _source;
      this.timeout = _timeout;
      this.invert = _invert;
   }

   this.coldStart = true;

   this.destActivated = false;
   this.sourceActive = false;
   this.timeoutObj = null;

   var that = this;

   events.EventEmitter.call(this);

   this.source.on('active', function (sourceName) {
      that.sourceIsActive(sourceName);
   });

   this.source.on('inactive', function (sourceName) {
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

   if (this.destActivated) {
      this.restartTimer();
   }
   else {
      this.activateDestination();
   }
}

Activator.prototype.sourceIsInactive = function(sourceName) {
   console.log('source ' + sourceName + ' inactive!');

   if (this.coldStart) {
      this.coldStart = false;
      this.destActivated = true;
   }

   this.sourceActive = false;

   if (this.destActivated) {

      // Destination is active. If there is no timeout, deactivate. Else, let the timer do it
      if (this.timeout == 0) {
         this.deactivateDestination();
      }
   }
}

Activator.prototype.activateDestination = function() {
   this.destActivated = true;
   this.emit(this.invert ? 'inactive' : 'active', this.name); 
}

Activator.prototype.deactivateDestination = function() {
   this.destActivated = false;
   this.emit(this.invert ? 'active' : 'inactive', this.name); 
}

Activator.prototype.restartTimer = function() {
   var that = this;

   if (this.timeoutObj) {
      clearTimeout(this.timeoutObj);
   }

   this.timeoutObj = setTimeout(function() {
      that.deactivateDestination();
      that.timeoutObj = null;
   }), this.timeout*1000);
}

module.exports = exports = Activator;
