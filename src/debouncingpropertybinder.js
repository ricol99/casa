var util = require('util');
var Property = require('./property');

function DebouncingProperty(_config, _owner) {

   this.threshold = _config.threshold;
   this.timeoutObj = null;
   this.sourceActive = false;
   this.active = false;

   Property.call(this, _config, _owner);
}

util.inherits(DebouncingProperty, Property);

function copyData(_sourceData) {
   var newData = {};

   for (var prop in _sourceData) {

      if (_sourceData.hasOwnProperty(prop)){
         newData[prop] = _sourceData[prop];
      }
   }

   return newData;
}

function startTimer(_that) {

   _that.timeoutObj = setTimeout(function(_this) {
      _this.timeoutObj = null;

      if (_this.lastData) {
         _this.active = _this.sourceActive;
         _this.updatePropertyAfterRead(_this.sourceActive, _this.lastData);
         _this.lastData = null;
      }

      if (!_this.enabled) {
         Property.prototype.sourceIsInvalid.call(_this, _this.invalidData);
      }
   }, _that.threshold*1000, _that);
}

DebouncingProperty.prototype.newPropertyValueReceivedFromSource = function(_sourceListener, _data) {
   var propValue = _data.propertyValue;
   console.log(this.uName + ':source ' + _data.sourceName + ' property ' + _data.propertyName + ' has changed to ' + propValue + '!');

   if (_data.coldStart) {    // Cold start only once
      this.sourceActive = propValue;
      this.active = propValue;
      this.updatePropertyAfterRead(propValue, _data);
      return;
   }

   if (this.active == propValue) {   // Current output is the same as new input, just update input
      this.sourceActive = propValue;
   }
   else if (this.sourceActive != propValue) {   // Input has changed, start timer and ignore until timer expires
      this.sourceActive = propValue;
      this.lastData = copyData(_data);  // TODO: Should we cache positive and negative case?

      // If a timer is already running, ignore. ELSE create one
      if (this.timeoutObj == null) {
         startTimer(this);
      }
   }
};

DebouncingProperty.prototype.sourceIsInvalid = function(_data) {
   console.log(this.uName + ': Source ' + _data.sourceName + ' property ' + _data.propertyName + ' invalid!');
   this.invalidData = copyData(_data);

   if (this.enabled) {
      this.enabled = false;

      // If a timer is already running, ignore. ELSE create one
      if (this.timeoutObj == null) {
         startTimer(this);
      }
   }
};

module.exports = exports = DebouncingProperty;
