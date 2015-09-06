var util = require('util');
var PropertyBinder = require('./propertybinder');
var LightwaveRF = require("lightwaverf");

function LightwaveRFPropertyBinder(_config, _owner) {

   this.roomID = _config.roomID;
   this.deviceID = _config.deviceID;

   PropertyBinder.call(this, _config, _owner);
   this.writeable = true;

   this.cStart = true;

   var that = this;
}

util.inherits(LightwaveRFPropertyBinder, PropertyBinder);

LightwaveRFPropertyBinder.prototype.setProperty = function(_propValue, _data, _callback) {
   var that = this;

   var callbackHandler = function(_error, _content) {
      if (_error) {
         console.log(that.name + ': Error turning room off ' + _error.message);
         _callback(false);
      } else {
         that.updatePropertyAfterRead(_propValue, _data);
         _callback(true);
      }
   };

   console.log(this.name + ": Attempting to apply property change to LightwaveRF device ID=" + this.deviceID);

   if (this.source) {

      if (typeof _propValue == "boolean") {

         if (_propValue) {
            this.source.turnDeviceOn(this.roomID, this.deviceID, callbackHandler);
         }
         else {
            this.source.turnDeviceOff(this.roomID, this.deviceID, callbackHandler);
         }
      }
      else if (_propValue == 0) {
         this.source.turnDeviceOff(this.roomID, this.deviceID, callbackHandler);
      }
      else {
         this.source.setDeviceDim(this.roomID, this.deviceID, _propValue, callbackHandler);
      }
   }
}

module.exports = exports = LightwaveRFPropertyBinder;

