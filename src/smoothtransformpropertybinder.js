var util = require('util');
var PropertyBinder = require('./propertybinder');

function SmoothTransformPropertyBinder(_config, _owner) {

   this.rate = _config.rate;                    // Change allowed per second
   this.resolution = _config.resolution;        // Refresh rate in seconds

   this.floorOutput = (_config.floorOutput == undefined) ? function(_input) { return Math.floor(_input); } : function(_input) { return _input; };
   this.calcuatedResolution = _config.resolution;
   this.targetOutput = 0;
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
      _that.clearTimeout(_that.timeoutObj);
   }

   _that.timeoutObj = setTimeout(function(_this) {
      _this.timeoutObj = null;

      if (_this.binderEnabled) {
        var difference = _this.targetOutput - _this.myPropertyValue();

         if (Math.abs(_this.step) < Math.abs(difference)) {
            _this.updatePropertyAfterRead(_this.targetOutput, _this.lastData);
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

   if (this.targetOutput != propValue) {
      this.targetOutput = propValue;

      var difference = this.targetOutput - this.myPropertyValue;

      if (this.resolution == undefined) {
         var totalTimeToChange = Math.abs(difference) / rate;
         var timeToChangeByOne =  totalTimeToChange / Math.abs(difference);
         this.calculatedResolution = (this.resolution != undefined) ? timeToChangeByOne : this.resolution;
      }

      this.step = difference / this.calculatedResolution;

      if (Math.abs(this.step) < Math.abs(difference)) {
         this.updatePropertyAfterRead(propValue, _data);
      }
      else {
         restartTimer(this);
      }
   }
};

module.exports = exports = SmoothTransformPropertyBinder;
