var util = require('util');
var PropertyBinder = require('./propertybinder');
var LightwaveRF = require("lightwaverf");

function LightwaveRFPropertyBinder(_config, _source) {

   this.roomID = _config.roomID;
   this.deviceID = _config.deviceID;

   PropertyBinder.call(this, _config, _source);

   this.cStart = true;

   var that = this;
}

util.inherits(LightwaveRFPropertyBinder, PropertyBinder);

LightwaveRFPropertyBinder.prototype.setProperty = function(_propValue, _callback) {
   var that = this;

   var callbackHandler = function(_error, _content) {
      if (_error) {
         console.log(that.name + ': Error turning room off ' + _error.message);
         _callback(false);
      } else {
         _callback(true);
      }
   };

   if (this.target) {

      if (typeof _propValue == "boolean") {

         if (_propValue) {
            this.target.turnDeviceOn(this.roomID, this.deviceID, callbackHandler);
         }
         else {
            this.target.turnDeviceOff(this.roomID, this.deviceID, callbackHandler);
         }
      }
      else {
         this.target.setDeviceDim(this.roomID, this.deviceID, _propValue, callbackHandler);
      }
   }
}

module.exports = exports = LightwaveRFPropertyBinder;

