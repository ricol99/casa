var util = require('util');
var PipelineStep = require('../pipelinestep');

function LatchStep(_config, _pipeline) {

   this.minOutputTime = _config.minOutputTime;

   PipelineStep.call(this, _config, _pipeline);

   this.minOutputTimeObj = null;
   this.sourceActive = false;
   this.active = false;
   this.lastData = null;
}

util.inherits(LatchStep, PipelineStep);

LatchStep.prototype.process = function(_value, _data) {
   var propValue = _value;
   this.lastData = _data;

   if (propValue) {
      console.log(this.uName + ': target ' + _data.sourceName + ' active!');
      this.sourceActive = true;
   
      if (this.minOutputTime != undefined) {
         this.restartTimer();
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

LatchStep.prototype.restartTimer = function() {

   if (this.minOutputTimeObj) {
      clearTimeout(this.minOutputTimeObj);
   }

   this.minOutputTimeObj = setTimeout(function(_that) {
      _that.minOutputTimeObj = null;

      if (!_that.sourceActive) {
         _that.active = false;

         if (_that.lastData) {
            _that.outputForNextStep(false, _that.lastData);
            _that.lastData = null;
            return;
         }
      }
   }, this.minOutputTime*1000, this);
}

function copyData(_sourceData) {
   var newData = {};

   for (var prop in _sourceData) {

      if (_sourceData.hasOwnProperty(prop)){
         newData[prop] = _sourceData[prop];
      }
   }

   return newData;
}

module.exports = exports = LatchStep;
