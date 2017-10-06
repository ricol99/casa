var util = require('util');
var Thing = require('../thing');
var CasaSystem = require('../casasystem');

function LightwaveRfAccessory(_config) {
   this.casaSys = CasaSystem.mainInstance();
   this.roomId = _config.roomId;

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
      this.deviceId = _config.deviceId;
   }

   this.ensurePropertyExists('power', 'property', { initialValue: false }, _config);

   if (_config.brightnessSupported) {
      this.brightnessSupported = true;
      this.ensurePropertyExists('brightness', 'property', { initialValue: 100 }, _config);
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

   this.powerCallbackHandler = function(_error, _content) {

      if (_error) {
         console.error(that.uName + ': Error callling lightwave service for power change. Error=' + _error);
      }
   };

   this.brightnessCallbackHandler = function(_error, _content) {

      if (_error) {
         console.error(that.uName + ': Error calling lightwave service for brightness change. Error=' + _error);
      }
   };

   if (this.deviceId != undefined) {
      console.log(this.uName + ": Attempting to apply property change to LightwaveRf device Id=" + this.deviceId);

      if (!_data.coldStart) {

         if (_propName == "power") {

            if (_propValue) {

               if (this.brightnessSupported) {
                  this.lightwaveRfService.setDeviceDim(this.roomId, this.deviceId, this.props["brightness"].value, this.powerCallbackHandler);
               }
               else {
                  this.lightwaveRfService.turnDeviceOn(this.roomId, this.deviceId, this.powerCallbackHandler);
               }
            }
            else {
               this.lightwaveRfService.turnDeviceOff(this.roomId, this.deviceId, this.powerCallbackHandler);
            }
         }
         else if (_propName == "brightness") {

            if (_propValue == 0) {
               this.lightwaveRfService.turnDeviceOff(this.roomId, this.deviceId, this.brightnessCallbackHandler);
            }
            else {
               this.lightwaveRfService.setDeviceDim(this.roomId, this.deviceId, _propValue, this.brightnessCallbackHandler);
            }
         }
      }
   }
   else if (this.moods != undefined) {

      if (_propName == "mood") {

         if (_propValue == "off") {
            console.log(this.uName + ": Attempting to turn off LightwaveRf room Id=" + this.roomId);

            if (!_data.coldStart) {
               this.lightwaveRfService.turnRoomOff(this.roomId, this.powerCallbackHandler);
            }
         }
         else {
            console.log(this.uName + ": Attempting to apply mood " + _propValue + " change to LightwaveRf room Id=" + this.roomId);

            if (this.moods[_propValue] == undefined) {
               console.error(this.uName + ": Configuration Error! Trying to apply mood="+_propValue+" which is not in the configuration!");
            }
            else if (!_data.coldStart) {
               this.lightwaveRfService.setRoomMood(this.roomId, this.moods[_propValue].id, this.powerCallbackHandler);
            }
         }
      }
      else if (_propName == "power" && !_propValue) {
         console.log(this.uName + ": Attempting to turn off LightwaveRf room Id=" + this.roomId);

         if (!_data.coldStart) {
            this.lightwaveRfService.turnRoomOff(this.roomId, this.powerCallbackHandler);
         }
         this.alignPropertyValue("mood", "off");
      }
      else {
         var brightness = (_propName == "brightness") ? _propValue : this.props["brightness"].value;
         var moodName = moodForBrightness(this.moods, brightness);

         if (moodName == "off") {
            console.log(this.uName + ": Attempting to turn off LightwaveRf room Id=" + this.roomId);

            if (!_data.coldStart) {
               this.lightwaveRfService.turnRoomOff(this.roomId, this.powerCallbackHandler);
            }
            this.alignPropertyValue("mood", "off");
         }
         else {
            console.log(this.uName + ": Attempting to apply mood " + _propValue + " change to LightwaveRf room Id=" + this.roomId);

            if (!_data.coldStart) {
               this.lightwaveRfService.setRoomMood(this.roomId, this.moods[moodName].id, this.powerCallbackHandler);
            }
            this.alignPropertyValue("mood", moodName);
         }
      }
   }
};


module.exports = exports = LightwaveRfAccessory;
