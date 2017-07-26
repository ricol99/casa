var util = require('util');
var schedule = require('node-schedule');
var SunCalc = require('suncalc');
var Parser = require('cron-parser');
var Service = require('../service');

function RampService(_config) {
   Service.call(this, _config);
}

util.inherits(RampService, Service);

RampService.prototype.createRamp = function(_owner, _ramp) {
   var ramp = new Ramp(_owner, _ramp, this);
   return ramp;
};

RampService.prototype.coldStart = function() {
   var that = this;
};

function Ramp(_owner, _config, _service) {
   this.name = _config.name;
   this.config = _config;
   this.service = _service;
   this.uName = _service.uName + ":" + _owner.uName + ":" + _config.name;
   this.owner = _owner;
   this.value = _config.startValue;

   this.endValue = _config.endValue;
   this.duration = _config.duration;
   this.step = _config.step;
   this.floorOutput = (_config.floorOutput != undefined) ? _config.floorOutput : true;

   var difference = Math.abs(this.endValue - this.value);
   var noOfSteps = difference / Math.abs(this.step);
   this.interval = this.duration / noOfSteps;

   setTimeout(function(_this) {
      _this.owner.newValueFromRamp(_this, _this.config, _this.value);
   }, 10, this);
}

Ramp.prototype.start = function() {
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
         _this.owner.newValueFromRamp(_this, _this.config, _this.endValue);
         _this.owner.rampComplete(_this, _this.config);
         delete _this;
      }
      else {
         _this.value += _this.step;
         _this.owner.newValueFromRamp(_this, _this.config, (_this.floorOutput) ? Math.floor(_this.value) : _this.value);
         _this.nextInterval();
      }
   }, this.interval * 1000, this);
};

module.exports = exports = RampService;
 
