var util = require('util');
var schedule = require('node-schedule');
var SunCalc = require('suncalc');
var Parser = require('cron-parser');
var Service = require('../service');

function RampService(_config, _owner) {
   Service.call(this, _config, _owner);
}

util.inherits(RampService, Service);

// Called when current state required
RampService.prototype.export = function(_exportObj) {
   Service.prototype.export.call(this, _exportObj);
};

// Called when current state required
RampService.prototype.import = function(_importObj) {
   Service.prototype.import.call(this, _importObj);
};

RampService.prototype.coldStart = function() {
   Service.prototype.coldStart.call(this);
};

RampService.prototype.hotStart = function() {
   Service.prototype.hotStart.call(this);
};

RampService.prototype.createRamp = function(_owner, _config) {
   var ramps = new Ramps(_owner, _config, this);
   return ramps;
};

function Ramps(_owner, _config, _service) {
   this.name = _config.name;
   this.config = _config;
   this.service = _service;
   this.name = _service.name + "-ramps-" + _owner.name + ":" + _config.name;
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

   if (this.ramps[this.ramps.length - 1].endValue !== _startValue) {
      this.startValue = _startValue;
      this.currentRamp = 0;
      this.ramps[0].start(_startValue);
   }
   else {

      for (var i = 0; i < this.ramps.length; ++i) {
         delete this.ramps[i];
      }

      setTimeout( () => {
         this.owner.rampComplete(this, this.config);
      }, 1);
   }
};

Ramps.prototype.cancel = function() {

   if (this.startTimeout) {
      clearTimeout(this.startTimeout);
      this.startTimeout = null;
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
   this.name = "ramp-" + this.ramps.name;

   this.endValue = this.config.endValue;
   this.duration = this.config.duration;

   if (_config.hasOwnProperty("step")) {
      this.step = this.config.step;
   }
   else {
      this.interval = _config.interval;
   }
}

Ramp.prototype.start = function(_currentValue) {
   this.value = this.config.hasOwnProperty("startValue") ? this.config.startValue : _currentValue;
   this.floorOutput = (this.config.hasOwnProperty("floorOutput")) ? this.config.floorOutput : true;

   var difference = Math.abs(this.endValue - this.value);

   var noOfSteps;

   if (this.hasOwnProperty("step")) {
      noOfSteps = difference / Math.abs(this.step);
      this.interval = this.duration / noOfSteps;

      if ((this.value > this.endValue) && (this.step > 0)) {
         this.step *= -1;
      }
   }
   else {
      noOfSteps = this.duration / this.interval;
      this.step = (this.endValue - this.value) / noOfSteps;
   }

   if (this.config.hasOwnProperty("startValue")) {

      setTimeout( () => {
         this.ramps.newValueFromRamp(this, (this.floorOutput) ? Math.floor(this.value) : this.value);
      }, 1);
   }

   this.nextInterval();
};

Ramp.prototype.nextInterval = function() {

   if (this.timer) {
      clearTimeout(this.timer);
   }

   this.timer = setTimeout( () => {
      this.timer = null;

      var difference = Math.abs(this.endValue - this.value);

      if (difference <= Math.abs(this.step)) {
         this.ramps.newValueFromRamp(this, this.endValue);
         this.ramps.rampComplete(this);
         delete this;
      }
      else {
         this.value += this.step;
         this.ramps.newValueFromRamp(this, (this.floorOutput) ? Math.floor(this.value) : this.value);
         this.nextInterval();
      }
   }, this.interval * 1000);
};

Ramp.prototype.cancel = function() {

   if (this.timer) {
      clearTimeout(this.timer);
   }

   delete this;
};

module.exports = exports = RampService;
 
