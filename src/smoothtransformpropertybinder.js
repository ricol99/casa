var util = require('util');
var PropertyBinder = require('./propertybinder');

function SmoothTransformPropertyBinder(_config, _owner) {

   this.rate = _config.rate;                    // Change allowed per second
   this.resolution = (_config.resolution == undefined) ? 1 : _config.resolution;

   this.floorOutput = (_config.floorOutput == undefined) ? function(_input) { return Math.floor(_input); } : function(_input) { return _input; };
   this.calculatedResolution = _config.resolution;
   this.targetValue = 0;
   this.timeoutObj = null;

   PropertyBinder.call(this, _config, _owner);
}

util.inherits(SmoothTransformPropertyBinder, PropertyBinder);

function copyData(_sourceData) {
   var newData = {};

   for (var prop in _sourceData) {

      if (_sourceData.hasOwnProperty(prop)){
         newData[prop] = _sourceData[prop];
      }
   }

   return newData;
}

function restartTimer(_that) {

   if (_that.timeoutObj) {
      clearTimeout(_that.timeoutObj);
   }

   _that.timeoutObj = setTimeout(function(_this) {
      _this.timeoutObj = null;

      if (_this.binderEnabled) {
        var difference = _this.targetValue - _this.myPropertyValue();

         if (Math.abs(difference) <= Math.abs(_this.step)) {
            _this.updatePropertyAfterRead(_this.targetValue, _this.lastData);
         }
         else {
            _this.updatePropertyAfterRead(_this.floorOutput(_this.myPropertyValue() + _this.step), _this.lastData);
            restartTimer(_this);
         }
      }
   }, _that.calculatedResolution * 1000, _that);
}

SmoothTransformPropertyBinder.prototype.newPropertyValueReceivedFromSource = function(_sourceListener, _data) {
   this.lastData = copyData(_data);
   var propValue = _data.propertyValue;

   if (this.targetValue != propValue) {
      this.targetValue = propValue;

      var difference = this.targetValue - this.myPropertyValue();

      var totalTimeToChange = Math.abs(difference) / this.rate;
      var timeToChangeByOne =  totalTimeToChange / Math.abs(difference);
      this.calculatedResolution = timeToChangeByOne * this.resolution;
      this.step = ((difference > 0) ? 1 : -1) * this.resolution;

      if (Math.abs(this.targetValue - this.myPropertyValue()) <= Math.abs(this.step)) {
         this.updatePropertyAfterRead(propValue, _data);
      }
      else {
         restartTimer(this);
      }
   }
};

module.exports = exports = SmoothTransformPropertyBinder;
