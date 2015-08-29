var util = require('util');
var PropertyBinder = require('./propertybinder');

function DebouncingPropertyBinder(_config, _owner) {

   this.threshold = _config.threshold;
   this.timeoutObj = null;
   this.sourceActive = false;

   PropertyBinder.call(this, _config, _owner);

   var that = this;
}

util.inherits(DebouncingPropertyBinder, PropertyBinder);

DebouncingPropertyBinder.prototype.sourcePropertyChanged = function(_data) {
   var that = this;
   console.log(this.name + ':source ' + _data.sourceName + ' property ' + _data.propertyName + ' has changed to ' + _data.propertyValue + '!');

   if (_data.coldStart || this.myProperty() == _data.propertyValue) {
      this.sourceActive = _data.propertyValue;
      this.updatePropertyAfterRead(_data.propertyValue, _data);
   }
   else if (this.sourceActive != _data.propertyValue) {
      this.sourceActive = _data.propertyValue;
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
   else if (_data.propertyValue) {
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
