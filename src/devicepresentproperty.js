var util = require('util');
var Property = require('./property');
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
   restartTimer(this);
}

// ====================
// NON-EXPORTED METHODS
// ====================

function restartTimer(_that) {

   if (_that.timeoutObj) {
      clearTimeout(_that.timeoutObj);
   }

   _that.timeoutObj = setTimeout(function(_this) {
      _this.timeoutObj = null;

      if (_this.binderEnabled) {
         var that2 = _this;

         ping.sys.probe(_this.host, function(_isAlive) {
            that2.updatePropertyInternal(_isAlive, { sourceName: that2.owner.name });
            restartTimer(that2);
         });
      }
   }, _that.interval * 1000, _that);
}

module.exports = exports = DevicePresentProperty;
