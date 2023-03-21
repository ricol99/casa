var util = require('util');
var HomekitAccessory = require('./hkaccessory');

var Accessory = require('hap-nodejs').Accessory;
var Service = require('hap-nodejs').Service;
var Characteristic = require('hap-nodejs').Characteristic;

function HomekitSwitchAccessory(_config, _parent) {
   HomekitAccessory.call(this, _config, _parent);
   this.thingType = "homekit-switch-accessory";

   this.stateless = _config.hasOwnProperty("stateless") ? _config.stateless : false;
   this.invokeManualMode = _config.hasOwnProperty("invokeManualMode") ? _config.invokeManualMode : !this.stateless;
   this.hkService = Service.Switch;

   this.hkAccessory
      .addService(this.hkService, this.displayName) // services exposed to the user should have "names" like "Light" for this case
      .getCharacteristic(Characteristic.On)
      .on('set', (_value, _callback) => {
         this.setSwitch(_value);
         _callback();
      })
      // We want to intercept requests for our current state so we can query the hardware itself instead of
      // allowing HAP-NodeJS to return the cached Characteristic.value.
      .on('get', (_callback) => {
         _callback(null, this.getSwitch());
      });

   this.eventName = _config.hasOwnProperty("eventName") ? _config.eventName : "switch-event";

   if (!this.stateless) {
      this.switchProp = _config.hasOwnProperty("switchProp") ? _config.switchProp : "ACTIVE";
      this.ensurePropertyExists(this.switchProp, 'property', { initialValue: false }, _config);
   }
}

util.inherits(HomekitSwitchAccessory, HomekitAccessory);

// Called when current state required
HomekitSwitchAccessory.prototype.export = function(_exportObj) {
   HomekitAccessory.prototype.export.call(this, _exportObj);
};

// Called when current state required
HomekitSwitchAccessory.prototype.import = function(_importObj) {
   HomekitAccessory.prototype.import.call(this, _importObj);
};

HomekitSwitchAccessory.prototype.coldStart = function() {
   HomekitAccessory.prototype.coldStart.call(this);
};

HomekitSwitchAccessory.prototype.hotStart = function() {
   HomekitAccessory.prototype.hotStart.call(this);
};

HomekitSwitchAccessory.prototype.setSwitch = function(_status) {

   if (this.stateless) {

      if (!this.timeout) {
         this.raiseEvent(this.eventName, { value: true, oldValue: false });
         this.setManualMode();

         this.timeout = setTimeout(function(_this) {
            _this.timeout = null;
            _this.hkAccessory
              .getService(Service.Switch)
              .getCharacteristic(Characteristic.On)
              .updateValue(0);
         }, 100, this);
      }
   }
   else {
      this.raiseEvent(this.eventName, { value: _status, oldValue: this.properties[this.switchProp].value });
      this.setManualMode();
      this.alignPropertyValue(this.switchProp, _status ? true : false);
   }
};

HomekitSwitchAccessory.prototype.getSwitch = function() {
   return (this.stateless) ? false : this.properties[this.switchProp].value ? 1 : 0;
};

HomekitSwitchAccessory.prototype.propertyAboutToChange = function(_propName, _propValue, _data) {

   if (_propName == this.switchProp) {
      this.hkAccessory
        .getService(Service.Switch)
        .getCharacteristic(Characteristic.On)
        .updateValue(_propValue ? 1 : 0);
   }
};

module.exports = exports = HomekitSwitchAccessory;
