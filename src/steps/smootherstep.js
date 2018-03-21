var util = require('./util');
var PipelineStep = require('../pipelinestep');

function SmootherStep(_config, _pipeline) {

   this.rate = _config.rate;                    // Change allowed per second
   this.resolution = (_config.resolution == undefined) ? 1 : _config.resolution;

   this.floorOutput = (_config.floorOutput == undefined) ? function(_input) { return Math.floor(_input); } : function(_input) { return _input; };
   this.calculatedResolution = _config.resolution;
   this.targetValue = 0;
   this.timeoutObj = null;
   this.cold = true;

   PipelineStep.call(this, _config, _pipeline);
}

util.inherits(SmootherStep, PipelineStep);

SmootherStep.prototype.restartTimer = function() {

   if (this.timeoutObj) {
      clearTimeout(this.timeoutObj);
   }

   this.timeoutObj = setTimeout(function(_this) {
      _this.timeoutObj = null;

      if (_this.valid) {
        var difference = _this.targetValue - _this.value;

         if (Math.abs(difference) <= Math.abs(_this.step)) {
            _this.outputForNextStep(_this.targetValue);
         }
         else {
            var newValue = _this.value + _this.step;
            _this.outputForNextStep(_this.floorOutput(newValue));
            _this.restartTimer();
         }
      }
   }, this.calculatedResolution * 1000, this);
}

SmootherStep.prototype.process = function(_value, _data) {

   if (this.cold) {
      this.cold = false;
      this.outputForNextStep(_value, _data);
   }
   else if (this.value != _value) {
      this.targetValue = _value;

      var difference = this.targetValue - this.value;

      var totalTimeToChange = Math.abs(difference) / this.rate;
      var timeToChangeByOne =  totalTimeToChange / Math.abs(difference);
      this.calculatedResolution = timeToChangeByOne * this.resolution;
      this.step = ((difference > 0) ? 1 : -1) * this.resolution;

      if (Math.abs(this.targetValue - this.value) <= Math.abs(this.step)) {
         this.outputForNextStep(_value, _data);
      }
      else {
         this.restartTimer();
      }
   }
};

module.exports = exports = SmootherStep;
