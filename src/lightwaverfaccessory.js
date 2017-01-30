var util = require('util');
var Thing = require('./thing');
var CasaSystem = require('./casasystem');

function LightwaveRfAccessory(_config) {
   this.casaSys = CasaSystem.mainInstance();
   this.roomID = _config.roomID;

   Thing.call(this, _config);
   this.thingType = "lightwave-accessory";

   if (_config.moods != undefined) {
      this.moods = {};
      this.props["mood"] = false;
      this.brightnessSupported = true;
      this.props["brightness"] = 100;

      for (var index = 0; index < _config.moods.length; ++index) {
         this.moods[_config.moods[index].name] = copyObject(_config.moods[index]);	// name, id, low, high

         this.moods[_config.moods[index].name].isActive = function(_brightness) {
            console.info("AAAAAAAAAAA low=" + this.low + " high=" + this.high + " b=" + _brightness + " res=" + ((this.low <= _brightness) && (this.high >= _brightness)));
            return (this.low <= _brightness) && (this.high >= _brightness);
         };
      }
   }
   else {
      this.deviceID = _config.deviceID;
   }

   this.props["power"] = false;

   if (_config.brightnessSupported) {
      this.brightnessSupported = true;
      this.props["brightness"] = 100;
   }
   else if (_config.brightnessThreshold) {
      this.props["brightness"] = 100;
      this.brightnessThresold = _config.brightnessThreshold;
   }

   this.displayName = _config.displayName;

   if (_config.lightwaveRfLink) {
      this.lightwaveRfLink =  this.casaSys.findSource(_config.lightwaveRfLink);

      if (!this.lightwaveRfLink) {
         console.error(this.name + ": ***** LightwaveRfLink not found! *************");
         process.exit();
      }
   }
}

util.inherits(LightwaveRfAccessory, Thing);

function copyObject(_sourceObject) {
   var newObject = {};

   for (var prop in _sourceObject) {

      if (_sourceObject.hasOwnProperty(prop)){
         newObject[prop] = _sourceObject[prop];
      }
   }

   return newObject;
}

function moodForBrightness(_moods, _brightness) {
   for (var moodName in _moods) {

      if (_moods.hasOwnProperty(moodName)) {

         if (_moods[moodName].isActive(_brightness)) {
            return moodName;
         }
      }
   }
   return "off";
}

LightwaveRfAccessory.prototype.updateProperty = function(_propName, _propValue, _data) {
   var that = this;

   if (this.brightnessThreshold != undefined) {

      if (_propName == "power" && _propValue == true && this.props["brightness"] < this.brightnessThreshold) {
         return;
      }

      if (_propName == "brightness" && _propValue < this.brightnessThreshold) {
         Thing.prototype.updateProperty.call(this, "brightness", _propValue, _data);
         return;
      }
   }

   this.callbackHandler = function(_error, _content) {
      if (_error) {
         console.log(that.name + ': Error turning room off ' + _error.message);
      }
   };

   if (this.deviceID != undefined) {
      console.log(this.name + ": Attempting to apply property change to LightwaveRf device ID=" + this.deviceID);

      if (_propName == "power") {

         if (_propValue) {

            if (this.brightnessSupported) {
               if (!_data.coldStart) {
                  this.lightwaveRfLink.setDeviceDim(this.roomID, this.deviceID, this.props["brightness"], this.callbackHandler);
               }
            }
            else {
               if (!_data.coldStart) {
                  this.lightwaveRfLink.turnDeviceOn(this.roomID, this.deviceID, this.callbackHandler);
               }
            }
         }
         else {
            if (!_data.coldStart) {
               this.lightwaveRfLink.turnDeviceOff(this.roomID, this.deviceID, this.callbackHandler);
            }
         }
      }
      else if (_propName == "brightness") {

         if (_propValue == 0) {

            if (!_data.coldStart) {
               this.lightwaveRfLink.turnDeviceOff(this.roomID, this.deviceID, this.callbackHandler);
            }
            Thing.prototype.updateProperty.call(this, "power", false, _data);
         }
         else {
            if (!_data.coldStart) {
               this.lightwaveRfLink.setDeviceDim(this.roomID, this.deviceID, _propValue, this.callbackHandler);
            }
         }
      }
   }
   else if (this.moods != undefined) {

      if (_propName == "mood") {

         if (_propValue == "off") {
            console.log(this.name + ": Attempting to turn off LightwaveRf room ID=" + this.roomID);

            if (!_data.coldStart) {
               this.lightwaveRfLink.turnRoomOff(this.roomID, this.callbackHandler);
            }
         }
         else {
            console.log(this.name + ": Attempting to apply mood " + _propValue + " change to LightwaveRf room ID=" + this.roomID);

            if (!_data.coldStart) {
               this.lightwaveRfLink.setRoomMood(this.roomID, this.moods[_propValue].id, this.callbackHandler);
            }
         }
      }
      else if (_propName == "power" && !_propValue) {
         console.log(this.name + ": Attempting to turn off LightwaveRf room ID=" + this.roomID);

         if (!_data.coldStart) {
            this.lightwaveRfLink.turnRoomOff(this.roomID, this.callbackHandler);
         }
         Thing.prototype.updateProperty.call(this, "mood", "off", _data);
      }
      else {
         var brightness = (_propName == "brightness") ? _propValue : this.props["brightness"];
         var moodName = moodForBrightness(this.moods, brightness);

         if (moodName == "off") {
            console.log(this.name + ": Attempting to turn off LightwaveRf room ID=" + this.roomID);

            if (!_data.coldStart) {
               this.lightwaveRfLink.turnRoomOff(this.roomID, this.callbackHandler);
            }
            Thing.prototype.updateProperty.call(this, "mood", "off", _data);
         }
         else {
            console.log(this.name + ": Attempting to apply mood " + _propValue + " change to LightwaveRf room ID=" + this.roomID);

            if (!_data.coldStart) {
               this.lightwaveRfLink.setRoomMood(this.roomID, this.moods[moodName].id, this.callbackHandler);
            }
            Thing.prototype.updateProperty.call(this, "mood", moodName, _data);
         }
      }
   }
   
   Thing.prototype.updateProperty.call(this, _propName, _propValue, _data);
};


module.exports = exports = LightwaveRfAccessory;
