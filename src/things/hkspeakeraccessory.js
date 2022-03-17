var util = require('util');
var HomekitAccessory = require('./hkaccessory');

var Accessory = require('hap-nodejs').Accessory;
var Service = require('hap-nodejs').Service;
var Characteristic = require('hap-nodejs').Characteristic;

function HomekitSpeakerAccessory(_config, _parent) {

   HomekitAccessory.call(this, _config, _parent);
   this.thingType = "homekit-speaker-accessory";
   this.volumeSupported = (_config.hasOwnProperty('volumeSupported')) ? _config.volumeSupported : true;
   this.ensurePropertyExists('muted', 'property', { initialValue: false }, _config);

   if (this.volumeSupported) {
      this.ensurePropertyExists('volume', 'property', { initialValue: 1 }, _config);
   }

   this.hkAccessory
      .addService(Service.Speaker, this.displayName) // services exposed to the user should have "names" like "Speaker" for this case
      .getCharacteristic(Characteristic.Mute)
      .on('set', (_value, _callback) => {
         this.setMuted(_value);
         _callback();
      })
      // We want to intercept requests for our current power state so we can query the hardware itself instead of
      // allowing HAP-NodeJS to return the cached Characteristic.value.
      .on('get', (_callback) => {
         _callback(null, this.getMuted());
      });

   if (this.volumeSupported) {
      this.ensurePropertyExists('volume', 'property', { initialValue: 1 }, _config);

      this.hkAccessory
        .getService(Service.Speaker)
        .addCharacteristic(Characteristic.Volume)
        .on('set', (_value, _callback) => {
          this.setVolume(_value);
          _callback();
        })
        .on('get', (_callback) => {
          _callback(null, this.getVolume());
        });
   }
}

util.inherits(HomekitSpeakerAccessory, HomekitAccessory);

HomekitSpeakerAccessory.prototype.setMuted = function(_status) {
   this.alignPropertyValue("muted", _status ? true : false);
};

HomekitSpeakerAccessory.prototype.getMuted = function() {
   return this.properties["muted"].value ? 1 : 0;
};

HomekitSpeakerAccessory.prototype.setVolume = function(_status) {
   console.log(this.uName + ": Changing volume to " + _status);
   this.setManualMode("volume");
   this.alignPropertyValue("volume", _status);
};

HomekitSpeakerAccessory.prototype.getVolume = function() {
   return this.properties["volume"].value;
}

HomekitSpeakerAccessory.prototype.propertyAboutToChange = function(_propName, _propValue, _data) {

   if (_propName == "muted") {
      this.hkAccessory
        .getService(Service.Speaker)
        .getCharacteristic(Characteristic.Mute)
        .updateValue(_propValue ? 1 : 0);
   }
   else if (_propName == "volume") {
      this.hkAccessory
        .getService(Service.Speaker)
        .getCharacteristic(Characteristic.Volume)
        .updateValue(_propValue);
   }
};

module.exports = exports = HomekitSpeakerAccessory;
