var util = require('util');
var PropertyBinder = require('./propertybinder');
var LightwaveRF = require("lightwaverf");

function LightwaveRFPropertyBinder(_config, _owner) {

   this.roomID = _config.roomID;
   this.moods = {};

   if (_config.moods != undefined) {

      for (var index = 0; index < _config.moods.length; ++index) {
         this.moods[_config.moods[index].name] = _config.moods[index].moodID;
      }
   }
   else {
      this.deviceID = _config.deviceID;
   }

   PropertyBinder.call(this, _config, _owner);
}

util.inherits(LightwaveRFPropertyBinder, PropertyBinder);

LightwaveRFPropertyBinder.prototype.calculateNewOutputValue = function(_sourceListener, _data, _callback) {
   var that = this;
   var propValue = _data.propertyValue;

   var callbackHandler = function(_error, _content) {
      if (_error) {
         console.log(that.name + ': Error turning room off ' + _error.message);
         _callback(_error);
      } else {
         _callback(null, propValue);
      }
   };

   if (this.target) {

      if (this.deviceID != undefined) {
         console.log(this.name + ": Attempting to apply property change to LightwaveRF device ID=" + this.deviceID);

         if (typeof propValue == "boolean") {

            if (propValue) {
               this.target.turnDeviceOn(this.roomID, this.deviceID, callbackHandler);
            }
            else {
               this.target.turnDeviceOff(this.roomID, this.deviceID, callbackHandler);
            }
         }
         else if (propValue == 0) {
            this.target.turnDeviceOff(this.roomID, this.deviceID, callbackHandler);
         }
         else {
            this.target.setDeviceDim(this.roomID, this.deviceID, propValue, callbackHandler);
         }
      }
      else if (propValue == "off") {
         console.log(this.name + ": Attempting to turn off LightwaveRF room ID=" + this.roomID);
         this.target.turnRoomOff(this.roomID, callbackHandler);
      }
      else {
         console.log(this.name + ": Attempting to apply mood " + propValue + " change to LightwaveRF room ID=" + this.roomID);
         this.target.setRoomMood(this.roomID, this.moods[propValue], callbackHandler);
      }
   }
}

module.exports = exports = LightwaveRFPropertyBinder;

