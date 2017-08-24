var util = require('util');
var HomekitAccessory = require('./hkaccessory');

var Accessory = require('hap-nodejs').Accessory;
var Service = require('hap-nodejs').Service;
var Characteristic = require('hap-nodejs').Characteristic;

function HomekitSwitchAccessory(_config) {
   var that = this;

   HomekitAccessory.call(this, _config);
   this.thingType = "homekit-switch-accessory";

   this.stateless = _config.hasOwnProperty("stateless") ? _config.stateless : false;
   this.hkService = Service.Switch;

   this.hkAccessory
      .addService(this.hkService, this.displayName) // services exposed to the user should have "names" like "Light" for this case
      .getCharacteristic(Characteristic.On)
      .on('set', function(_value, _callback) {
         that.setSwitch(_value);
         _callback();
      })
      // We want to intercept requests for our current state so we can query the hardware itself instead of
      // allowing HAP-NodeJS to return the cached Characteristic.value.
      .on('get', function(_callback) {
         _callback(null, that.getSwitch());
      });

   this.eventName = _config.hasOwnProperty("eventName") ? _config.eventName : "switch-event";

   if (!this.stateless) {
      this.switchProp = _config.hasOwnProperty("switchProp") ? _config.switchProp : "ACTIVE";
      this.ensurePropertyExists(this.switchProp, 'property', { initialValue: false }, _config);
   }
}

util.inherits(HomekitSwitchAccessory, HomekitAccessory);

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
      this.raiseEvent(this.eventName, { value: _status, oldValue: this.props[this.switchProp].value });
      //this.props[this.switchProp].setManualMode(true);
      this.setManualMode();
      this.updateProperty(this.switchProp, _status ? true : false);
   }
};

HomekitSwitchAccessory.prototype.getSwitch = function() {
   return (this.stateless) ? false : this.props[this.switchProp].value ? 1 : 0;
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
