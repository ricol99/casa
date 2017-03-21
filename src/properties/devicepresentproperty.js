var util = require('util');
var Property = require('../property');
var ping = require('ping');

function DevicePresentProperty(_config, _owner) {

   this.host = _config.host;
   this.interval = (_config.interval == undefined) ? 60 : _config.interval;

   Property.call(this, _config, _owner);
}

util.inherits(DevicePresentProperty, Property);

DevicePresentProperty.prototype.setProperty = function(_propValue, _data) {
   console.log(this.uName + ': Not allowed to set property ' + this.name + ' to ' + _propValue);
   return false;
}

DevicePresentProperty.prototype.coldStart = function(_event) {
   this.restartTimer();
}

// ====================
// NON-EXPORTED METHODS
// ====================

DevicePresentProperty.prototype.restartTimer = function() {

   if (this.timeoutObj) {
      clearTimeout(this.timeoutObj);
   }

   this.timeoutObj = setTimeout(function(_this) {
      _this.timeoutObj = null;

      if (_this.valid) {
         var that2 = _this;

         ping.sys.probe(_this.host, function(_isAlive) {
            that2.updatePropertyInternal(_isAlive);
            restartTimer(that2);
         });
      }
   }, this.interval * 1000, this);
}

module.exports = exports = DevicePresentProperty;
