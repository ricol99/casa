var util = require('util');
var PropertyBinder = require('./propertybinder');

function LatchingPropertyBinder(_config, _owner) {

   this.minOutputTime = (_config.minOutputTime) ? _config.minOutputTime : 0;
   _config.defaultTriggerConditions = true;

   PropertyBinder.call(this, _config, _owner);

   this.minOutputTimeObj = null;
   this.latestInactiveData = { sourceName: this.name };
   var that = this;
   this.cStart = true;
   this.sourceActive = false;
}

util.inherits(LatchingPropertyBinder, PropertyBinder);

LatchingPropertyBinder.prototype.setProperty = function(_propValue, _data, _callback) {

   if (_propValue) {
      console.log(this.name + ': target ' + _data.sourceName + ' active!');
      this.sourceActive = true;
   
      this.restartTimer();
      this.updatePropertyAfterRead(true, _data);
   }
   else {
      console.log(this.name + ': target ' + _data.sourceName + ' inactive!');
      this.sourceActive = false;

      if (this.myPropertyValue()) {

         // Destination is active. If there is no timer, deactivate. Else, let the timer do it
         if (this.minOutputTimeObj == null) {
            this.updatePropertyAfterRead(false, _data);
         }
         else {
            // save data for the timer to use
            this.latestInactiveData = _data;
         }
      }
   }
   _callback(true);
}

LatchingPropertyBinder.prototype.restartTimer = function() {
   var that = this;

   if (this.minOutputTimeObj) {
      clearTimeout(this.minOutputTimeObj);
   }

   this.minOutputTimeObj = setTimeout(function() {
      that.minOutputTimeObj = null;

      if (!that.sourceActive) {
         that.updatePropertyAfterRead(false, this.latestInactiveData);
      }
   }, this.minOutputTime*1000);
}

LatchingPropertyBinder.prototype.sourcePropertyChanged = function(_data) {
   this.setProperty(_data.propertyValue, _data, function() {});
}

module.exports = exports = LatchingPropertyBinder;
