var util = require('util');
var Activator = require('./activator');

function LatchingActivator(_config) {

   this.sourceName = _config.source;
   this.minOutputTime = (_config.minOutputTime) ? _config.minOutputTime : 0;

   Activator.call(this, _config);

   this.sourceActive = false;
   this.minOutputTimeObj = null;
   this.latestInactiveData = { sourceName: this.name };
   var that = this;
}

util.inherits(LatchingActivator, Activator);

LatchingActivator.prototype.sourceIsActive = function(_data) {
   console.log(this.name + ': source ' + _data.sourceName + ' active!');
   
   this.sourceActive = true;
   this.restartTimer();
   this.goActive(_data);
}

LatchingActivator.prototype.sourceIsInactive = function(_data) {
   console.log(this.name + ': source ' + _data.sourceName + ' inactive!');

   this.sourceActive = false;

   if (this.isActive()) {

      // Destination is active. If there is no timer, deactivate. Else, let the timer do it
      if (this.minOutputTimeObj == null) {
         this.goInactive(_data);
      }
      else {
         // save data for the timer to use
         this.latestInactiveData = _data;
      }
   }
}

LatchingActivator.prototype.restartTimer = function() {
   var that = this;

   if (this.minOutputTimeObj) {
      clearTimeout(this.minOutputTimeObj);
   }

   this.minOutputTimeObj = setTimeout(function() {
      that.minOutputTimeObj = null;

      if (!that.active) {
         that.goInactive(this.latestInactiveData);
      }
   }, this.minOutputTime*1000);
}

module.exports = exports = LatchingActivator;