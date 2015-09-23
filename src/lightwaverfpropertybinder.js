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


   if (this.target) {

      if (this.deviceID != undefined) {
         console.log(this.name + ": Attempting to apply property change to LightwaveRF device ID=" + this.deviceID);

         if (typeof _propValue == "boolean") {

            if (_propValue) {
               this.target.turnDeviceOn(this.roomID, this.deviceID, callbackHandler);
            }
            else {
               this.target.turnDeviceOff(this.roomID, this.deviceID, callbackHandler);
            }
         }
         else if (_propValue == 0) {
            this.target.turnDeviceOff(this.roomID, this.deviceID, callbackHandler);
         }
         else {
            this.target.setDeviceDim(this.roomID, this.deviceID, _propValue, callbackHandler);
         }
      }
      else if (_propValue == "off") {
         console.log(this.name + ": Attempting to turn off LightwaveRF room ID=" + this.roomID);
         this.target.turnRoomOff(this.roomID, callbackHandler);
      }
      else {
         console.log(this.name + ": Attempting to apply mood " + _propValue + " change to LightwaveRF room ID=" + this.roomID);
         this.target.setRoomMood(this.roomID, this.moods[_propValue], callbackHandler);
      }
   }
}

LightwaveRFPropertyBinder.prototype.sourceIsActive = function(_data) {
   this.setProperty(true, _data, function() {} );
}

LightwaveRFPropertyBinder.prototype.sourceIsInactive = function(_data) {
   this.setProperty(false, _data, function() {} );
}

LightwaveRFPropertyBinder.prototype.sourcePropertyChanged = function(_data) {
   this.setProperty(_data.propertyValue, _data, function() {} );
}

module.exports = exports = LightwaveRFPropertyBinder;

