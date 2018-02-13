var util = require('util');
var schedule = require('node-schedule');
var SunCalc = require('suncalc');
var Parser = require('cron-parser');
var Service = require('../service');

function RampService(_config) {
   Service.call(this, _config);
}

util.inherits(RampService, Service);

RampService.prototype.createRamp = function(_owner, _config) {
   var ramps = new Ramps(_owner, _config, this);
   return ramps;
};

RampService.prototype.coldStart = function() {
};

function Ramps(_owner, _config, _service) {
   this.name = _config.name;
   this.config = _config;
   this.service = _service;
   this.uName = _service.uName + ":ramps:" + _owner.uName + ":" + _config.name;
   this.owner = _owner;
   this.ramps = [];
   this.loop = _config.hasOwnProperty("loop") ? _config.loop : false;
   this.iterations = _config.hasOwnProperty("iterations") ? _config.iterations : 1;
   this.iterationCounter = 0;
   this.startValue;

   if (_config.hasOwnProperty("ramps")) {

      for (var i = 0; i < _config.ramps.length; ++i) {
         this.ramps.push(new Ramp(this, this.config.ramps[i]));
      }
   }
   else {
      this.ramps.push(new Ramp(this, this.config));
   }
}

Ramps.prototype.start = function(_startValue) {
   this.startValue = _startValue;
   this.currentRamp = 0;
   this.ramps[0].start(_startValue);
};

Ramps.prototype.cancel = function() {

   if (this.startTimeout) {
      clearTimeout(this.startTimeout);
      _this.startTimeout = null;
   }
   else {
      this.ramps[this.currentRamp].cancel();
   }
   this.currentRamp = 0;
}

Ramps.prototype.newValueFromRamp = function(_ramp, _value) {
   this.owner.newValueFromRamp(this, this.config, _value);
};

Ramps.prototype.rampComplete = function(_ramp) {
   this.currentRamp++;

   if (this.currentRamp >= this.ramps.length) {
      this.currentRamp = 0;

      if (this.loop) {
         this.start(this.startValue);
      }
      else if (this.iterations && (++this.iterationCounter < this.iterations)) {
         this.start(this.startValue);
      }
      else {
         this.iterationCounter = 0;
         this.owner.rampComplete(this, this.config);
      }
   }
   else {
      this.ramps[this.currentRamp].start(this.ramps[this.currentRamp - 1].endValue);
   }
};

function Ramp(_ramps, _config) {
   this.name = _config.name;
   this.config = _config;
   this.ramps = _ramps;
   this.uName = "ramp:" + this.ramps.uName;

   this.endValue = this.config.endValue;
   this.duration = this.config.duration;
   this.step = this.config.step;
}

Ramp.prototype.start = function(_currentValue) {
   this.value = this.config.hasOwnProperty("startValue") ? this.config.startValue : _currentValue;
   this.floorOutput = (this.config.hasOwnProperty("floorOutput")) ? this.config.floorOutput : true;

   var difference = Math.abs(this.endValue - this.value);
   var noOfSteps = difference / Math.abs(this.step);
   this.interval = this.duration / noOfSteps;

   if (this.config.hasOwnProperty("startValue")) {

      setTimeout(function(_this) {
         _this.ramps.newValueFromRamp(_this, _this.value);
      }, 1, this);
   }

   this.nextInterval();
};

Ramp.prototype.nextInterval = function() {

   if (this.timer) {
      clearTimeout(this.timer);
   }

   this.timer = setTimeout(function(_this) {
      _this.timer = null;

     var difference = Math.abs(_this.endValue - _this.value);

      if (difference <= Math.abs(_this.step)) {
         _this.ramps.newValueFromRamp(_this, _this.endValue);
         _this.ramps.rampComplete(_this);
         delete _this;
      }
      else {
         _this.value += _this.step;
         _this.ramps.newValueFromRamp(_this, (_this.floorOutput) ? Math.floor(_this.value) : _this.value);
         _this.nextInterval();
      }
   }, this.interval * 1000, this);
};

Ramp.prototype.cancel = function() {

   if (this.timer) {
      clearTimeout(this.timer);
   }

   delete this;
};

module.exports = exports = RampService;
 
