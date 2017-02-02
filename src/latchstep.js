var util = require('util');
var Step = require('./step');

function LatchStep(_config, _owner) {

   this.minOutputTime = _config.minOutputTime;

   Step.call(this, _config, _owner);

   this.minOutputTimeObj = null;
   this.sourceActive = false;
   this.active = false;
   this.lastData = null;
}

util.inherits(LatchStep, Step);

LatchStep.prototype.process = function(_value, _data) {
   var propValue = _value;
   this.lastData = _data;

   if (propValue) {
      console.log(this.uName + ': target ' + _data.sourceName + ' active!');
      this.sourceActive = true;
   
      if (this.minOutputTime != undefined) {
         restartTimer(this);
         this.active = true;
         this.outputForNextStep(propValue, _data);
      }
   }
   else {
      console.log(this.uName + ': target ' + _data.sourceName + ' inactive!');
      this.sourceActive = false;

      if (this.active) {

         if (this.minOutputTime != undefined) {

            // Destination is active. If there is no timer, deactivate. Else, let the timer do it
            if (this.minOutputTimeObj == null) {
               this.active = false;
               this.outputForNextStep(false, _data);
            }
         }
      }
      else {
         this.active = false;
         this.outputForNextStep(false, _data);
      }
   }
}

// ====================
// NON_EXPORTED METHODS
// ====================

function restartTimer(_this) {

   if (_this.minOutputTimeObj) {
      clearTimeout(_this.minOutputTimeObj);
   }

   _this.minOutputTimeObj = setTimeout(function(_that) {
      _that.minOutputTimeObj = null;

      if (!_that.sourceActive) {
         _that.active = false;

         if (_that.lastData) {
            _that.outputForNextStep(false, _that.lastData);
            _that.lastData = null;
            return;
         }
      }
   }, _this.minOutputTime*1000, _this);
}

function copyData(_sourceData) {
   var newData = {};

   for (var prop in _sourceData) {

      if (_sourceData.hasOwnStep(prop)){
         newData[prop] = _sourceData[prop];
      }
   }

   return newData;
}

module.exports = exports = LatchStep;
