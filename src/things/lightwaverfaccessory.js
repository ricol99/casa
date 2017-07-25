var util = require('util');
var Thing = require('../thing');
var CasaSystem = require('../casasystem');

function LightwaveRfAccessory(_config) {
   this.casaSys = CasaSystem.mainInstance();
   this.roomID = _config.roomID;

   Thing.call(this, _config);
   this.thingType = "lightwave-accessory";

   if (_config.moods != undefined) {
      this.moods = {};
      this.ensurePropertyExists('mood', 'property', { initialValue: false }, _config);
      this.brightnessSupported = true;
      this.ensurePropertyExists('brightness', 'property', { initialValue: 100 }, _config);

      for (var index = 0; index < _config.moods.length; ++index) {
         this.moods[_config.moods[index].name] = copyObject(_config.moods[index]);	// name, id, low, high

         this.moods[_config.moods[index].name].isActive = function(_brightness) {
            return (this.low <= _brightness) && (this.high >= _brightness);
         };
      }
   }
   else {
      this.deviceID = _config.deviceID;
   }

   this.ensurePropertyExists('power', 'property', { initialValue: false }, _config);

   if (_config.brightnessSupported) {
      this.brightnessSupported = true;
      this.ensurePropertyExists('brightness', 'property', { initialValue: 100 }, _config);
   }
   else if (_config.brightnessThreshold) {
      this.ensurePropertyExists('brightness', 'property', { initialValue: 100 }, _config);
      this.brightnessThresold = _config.brightnessThreshold;
   }

   this.displayName = _config.displayName;

   this.lightwaveRfService =  this.casaSys.findService("lightwaverfservice");

   if (!this.lightwaveRfService) {
      console.error(this.uName + ": ***** LightwaveRf service not found! *************");
      process.exit();
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

LightwaveRfAccessory.prototype.propertyAboutToChange = function(_propName, _propValue, _data) {
   var that = this;

   if (this.brightnessThreshold != undefined) {

      if (_propName == "power" && _propValue && this.props["brightness"].value < this.brightnessThreshold) {
         return;
      }

      if (_propName == "brightness" && _propValue > this.brightnessThreshold) {
         this.updateProperty("power", true);
         return;
      }
   }

   this.callbackHandler = function(_error, _content) {

      if (_error) {
         console.log(that.uName + ': Error turning room off ' + _error.message);
      }
   };

   if (this.deviceID != undefined) {
      console.log(this.uName + ": Attempting to apply property change to LightwaveRf device ID=" + this.deviceID);

      if (!_data.coldStart) {

         if (_propName == "power") {

            if (_propValue) {

               if (this.brightnessSupported) {
                  this.lightwaveRfService.setDeviceDim(this.roomID, this.deviceID, this.props["brightness"].value, this.callbackHandler);
                  }
               else {
                  this.lightwaveRfService.turnDeviceOn(this.roomID, this.deviceID, this.callbackHandler);
               }
            }
            else {
               this.lightwaveRfService.turnDeviceOff(this.roomID, this.deviceID, this.callbackHandler);
               }
         }
         else if (_propName == "brightness") {

            if (_propValue == 0) {
               this.lightwaveRfService.turnDeviceOff(this.roomID, this.deviceID, this.callbackHandler);
               this.updateProperty("power", false);
            }
               else {
               this.lightwaveRfService.setDeviceDim(this.roomID, this.deviceID, _propValue, this.callbackHandler);
            }
         }
      }
   }
   else if (this.moods != undefined) {

      if (_propName == "mood") {

         if (_propValue == "off") {
            console.log(this.uName + ": Attempting to turn off LightwaveRf room ID=" + this.roomID);

            if (!_data.coldStart) {
               this.lightwaveRfService.turnRoomOff(this.roomID, this.callbackHandler);
            }
         }
         else {
            console.log(this.uName + ": Attempting to apply mood " + _propValue + " change to LightwaveRf room ID=" + this.roomID);

            if (this.moods[_propValue] == undefined) {
               console.error(this.uName + ": Configuration Error! Trying to apply mood="+_propValue+" which is not in the configuration!");
            }
            else if (!_data.coldStart) {
               this.lightwaveRfService.setRoomMood(this.roomID, this.moods[_propValue].id, this.callbackHandler);
            }
         }
      }
      else if (_propName == "power" && !_propValue) {
         console.log(this.uName + ": Attempting to turn off LightwaveRf room ID=" + this.roomID);

         if (!_data.coldStart) {
            this.lightwaveRfService.turnRoomOff(this.roomID, this.callbackHandler);
         }
         this.updateProperty("mood", "off");
      }
      else {
         var brightness = (_propName == "brightness") ? _propValue : this.props["brightness"].value;
         var moodName = moodForBrightness(this.moods, brightness);

         if (moodName == "off") {
            console.log(this.uName + ": Attempting to turn off LightwaveRf room ID=" + this.roomID);

            if (!_data.coldStart) {
               this.lightwaveRfService.turnRoomOff(this.roomID, this.callbackHandler);
            }
            this.updateProperty("mood", "off");
         }
         else {
            console.log(this.uName + ": Attempting to apply mood " + _propValue + " change to LightwaveRf room ID=" + this.roomID);

            if (!_data.coldStart) {
               this.lightwaveRfService.setRoomMood(this.roomID, this.moods[moodName].id, this.callbackHandler);
            }
            this.updateProperty("mood", moodName);
         }
      }
   }
};


module.exports = exports = LightwaveRfAccessory;
