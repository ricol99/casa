var util = require('util');
var PropertyBinder = require('./propertybinder');
var ping = require('ping');

function DevicePresentPropertyBinder(_config, _owner) {

   this.host = _config.host;
   this.interval = (_config.interval == undefined) ? 60 : _config.interval;

   PropertyBinder.call(this, _config, _owner);
}

util.inherits(DevicePresentPropertyBinder, PropertyBinder);

function restartTimer(_that) {

   if (_that.timeoutObj) {
      clearTimeout(_that.timeoutObj);
   }

   _that.timeoutObj = setTimeout(function(_this) {
      _this.timeoutObj = null;

      if (_this.binderEnabled) {
         var that2 = _this;

         ping.sys.probe(_this.host, function(_isAlive) {
            that2.updatePropertyAfterRead(_isAlive, { sourceName: that2.owner.name });
            restartTimer(that2);
         });
      }
   }, _that.interval * 1000, _that);
}

DevicePresentPropertyBinder.prototype.coldStart = function(_event) {
   restartTimer(this);
}

module.exports = exports = DevicePresentPropertyBinder;
