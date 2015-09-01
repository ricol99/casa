var util = require('util');
var LogicPropertyBinder = require('./logicpropertybinder');

function DebouncingPropertyBinder(_config, _owner) {

   this.threshold = _config.threshold;
   this.timeoutObj = null;
   this.sourceActive = false;

   LogicPropertyBinder.call(this, _config, _owner);

   var that = this;
}

util.inherits(DebouncingPropertyBinder, LogicPropertyBinder);

DebouncingPropertyBinder.prototype.sourceIsActive = function(_data) {
   this.processSourceStateChange(true, _data);
}

DebouncingPropertyBinder.prototype.sourceIsInactive = function(_data) {
   this.processSourceStateChange(false, _data);
}

DebouncingPropertyBinder.prototype.processSourceStateChange = function(_active, _data) {
   var that = this;
   console.log(this.name + ':source ' + _data.sourceName + ' property ' + _data.propertyName + ' has changed to ' + _active + '!');

   if (_data.coldStart || this.myPropertyValue() == _active) {
      this.sourceActive = _active;
      this.updatePropertyAfterRead(_active, _data);
   }
   else if (this.sourceActive != _active) {
      this.sourceActive = _active;
      this.storedActiveData = _data;


      // If a timer is already running, ignore. ELSE create one
      if (this.timeoutObj == null) {

         this.timeoutObj = setTimeout(function() {
            that.timeoutObj = null;

            if (!that.binderEnabled) {
               that.goInvalid({ sourceName: that.name });
            }
            else if (that.sourceActive) {
               that.updatePropertyAfterRead(true, that.storedActiveData);
            }
            else {
               that.updatePropertyAfterRead(false, that.storedInactiveData);
            }
         }, this.threshold*1000);
      }
   }
   else if (_active) {
      this.storedActiveData = _data;
   }
   else {
      this.storedInactiveData = _data;
   }
};

DebouncingPropertyBinder.prototype.sourceIsInvalid = function(_data) {
   var that = this;
   console.log(this.name + ': Source ' + _data.sourceName + ' property ' + _data.propertyName + ' invalid!');

   if (this.binderEnabled) {
      this.binderEnabled = false;

      // If a timer is already running, ignore. ELSE create one
      if (this.timeoutObj == null) {

         this.timeoutObj = setTimeout(function() {
            that.timeoutObj = null;

            if (!that.binderEnabled) {
               that.goInvalid({ sourceName: that.name });
            }
            else if (that.sourceActive) {
               that.updatePropertyAfterRead(true, that.storedActiveData);
            }
            else {
               that.updatePropertyAfterRead(false, that.storedInactiveData);
            }
         }, this.threshold*1000);
      }
   }
};

module.exports = exports = DebouncingPropertyBinder;
