var util = require('util');
var HomekitAccessory = require('./hkaccessory');

var Accessory = require('hap-nodejs').Accessory;
var Service = require('hap-nodejs').Service;
var Characteristic = require('hap-nodejs').Characteristic;

function HomekitSpeakerAccessory(_config) {

   HomekitAccessory.call(this, _config);
   this.thingType = "homekit-speaker-accessory";
   this.volumeSupported = (_config.hasOwnProperty('volumeSupported')) ? _config.volumeSupported : true;
   this.ensurePropertyExists('muted', 'property', { initialValue: false });

   if (this.volumeSupported) {
      this.ensurePropertyExists('volume', 'property', { initialValue: 1 });
   }

   var that = this;

   this.hkAccessory
      .addService(Service.Speaker, this.displayName) // services exposed to the user should have "names" like "Speaker" for this case
      .getCharacteristic(Characteristic.Muted)
      .on('set', function(_value, _callback) {
         that.setMuted(_value);
         _callback();
      })
      // We want to intercept requests for our current power state so we can query the hardware itself instead of
      // allowing HAP-NodeJS to return the cached Characteristic.value.
      .on('get', function(_callback) {
         _callback(null, that.getMuted());
      });

   if (this.volumeSupported) {
      this.ensurePropertyExists('volume', 'property', { initialValue: 1 });

      this.hkAccessory
        .getService(Service.Speaker)
        .addCharacteristic(Characteristic.Volume)
        .on('set', function(_value, _callback) {
          that.setVolume(_value);
          _callback();
        })
        .on('get', function(_callback) {
          _callback(null, that.getVolume());
        });
   }
}

util.inherits(HomekitSpeakerAccessory, HomekitAccessory);

HomekitSpeakerAccessory.prototype.setMuted = function(_status) {
   this.updateProperty("muted", _status ? true : false, { sourceName: this.uName }, true);
};

HomekitSpeakerAccessory.prototype.getMuted = function() {
   return this.props["muted"].value ? 1 : 0;
};

HomekitSpeakerAccessory.prototype.setVolume = function(_status) {
   console.log(this.uName + ": Changing volume to " + _status);
   this.updateProperty("volume", _status, { sourceName: this.uName }, true);
};

HomekitSpeakerAccessory.prototype.getVolume = function() {
   return this.props["volume"].value;
}

HomekitSpeakerAccessory.prototype.updateProperty = function(_propName, _propValue, _data, _forceUpdate) {

   if (_propName == "muted") {
      this.hkAccessory
        .getService(Service.Speaker)
        .getCharacteristic(Characteristic.Muted)
        .updateValue(_propValue ? 1 : 0);
   }
   else if (_propName == "volume") {
      this.hkAccessory
        .getService(Service.Speaker)
        .getCharacteristic(Characteristic.Volume)
        .updateValue(_propValue);
   }

   HomekitAccessory.prototype.updateProperty.call(this, _propName, _propValue, _data, true);
};

module.exports = exports = HomekitSpeakerAccessory;
