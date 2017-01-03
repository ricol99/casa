var util = require('util');
var PropertyBinder = require('./propertybinder');

function DebouncingPropertyBinder(_config, _owner) {

   this.threshold = _config.threshold;
   this.timeoutObj = null;
   this.sourceActive = false;
   this.active = false;

   PropertyBinder.call(this, _config, _owner);
}

util.inherits(DebouncingPropertyBinder, PropertyBinder);

DebouncingPropertyBinder.prototype.newPropertyValueReceivedFromSource = function(_sourceListener, _data) {
   var that = this;
   this.lastdata = _data;

   var propValue = _data.propertyValue;
   console.log(this.name + ':source ' + _data.sourceName + ' property ' + _data.propertyName + ' has changed to ' + propValue + '!');

   if (_data.coldStart || this.active == propValue) {
      this.sourceActive = propValue;

      if (propValue) {
         this.active = true;
         this.updatePropertyAfterRead(true, _data);
         return;
      }
      else {
         this.active = false;
         this.updatePropertyAfterRead(false, _data);
         return;
      }
   }
   else if (this.sourceActive != propValue) {
      this.sourceActive = propValue;

      // If a timer is already running, ignore. ELSE create one
      if (this.timeoutObj == null) {

         this.timeoutObj = setTimeout(function() {
            that.timeoutObj = null;

            if (that.sourceActive) {
               that.active = true;
               that.updatePropertyAfterRead(true, _data);
               return;
            }
            else {
               this.active = false;
               that.updatePropertyAfterRead(false, _data);
               return;
            }

            if (!that.binderEnabled) {
               that.goInvalid({ sourceName: that.name });
            }
         }, this.threshold*1000);
      }
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

            if (that.lastData) {

               if (that.sourceActive) {
                  that.active = true;
                  that.updatePropertyAfterRead(true , { sourceName: that.ownerName });
               }
               else {
                  that.active = false;
                  that.updatePropertyAfterRead(false , { sourceName: that.ownerName });
               }
               that.lastData = null;
            }

            if (!that.binderEnabled) {
               that.goInvalid({ sourceName: that.name });
            }
         }, this.threshold*1000);
      }
   }
};

module.exports = exports = DebouncingPropertyBinder;
