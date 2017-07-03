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
   this.hkService = (this.stateless) ? Service.StatelessProgrammableSwitch : Service.StatefulProgrammableSwitch;

   this.hkAccessory
      .addService(this.hkService, this.displayName) // services exposed to the user should have "names" like "Light" for this case
      .getCharacteristic(Characteristic.ProgrammableSwitchEvent)
      .on('change', function(_oldValue, _newValue, _callback) {
         that.switchChanged(_oldValue, _newValue);
         _callback();
      })

   if (!this.stateless) {
      this.switchProp = _config.hasOwnProperty("switchProp") ? _config.switchProp : "ACTIVE";
      this.ensurePropertyExists(this.switchProp, 'property', { initialValue: false }, _config);

      this.hkAccessory
         .getService(this.hkService) // services exposed to the user should have "names" like "Light" for this case
         .getCharacteristic(Characteristic.ProgrammableSwitchOutputState)
         .on('set', function(_value, _callback) {
            that.setSwitch(_value);
            _callback();
         })
         // We want to intercept requests for our current state so we can query the hardware itself instead of
         // allowing HAP-NodeJS to return the cached Characteristic.value.
         .on('get', function(_callback) {
            _callback(null, that.getSwitch());
         });
   }
}

util.inherits(HomekitSwitchAccessory, HomekitAccessory);

HomekitSwitchAccessory.prototype.setSwitch = function(_status) {
   this.props[this.switchProp].setManualMode(true);
   this.updateProperty(this.switchProp, _status ? true : false);
};

HomekitSwitchAccessory.prototype.getSwitch = function() {
   return this.props[this.switchProp].value ? 1 : 0;
};

HomekitSwitchAccessory.prototype.switchChanged = function(_oldValue, _newValue) {
   this.raiseEvent("switch-event", { value: _newValue, oldValue: _oldValue });
};

HomekitSwitchAccessory.prototype.propertyAboutToChange = function(_propName, _propValue, _data) {

   if (_propName == this.switchProp) {
      this.hkAccessory
        .getService(Service.StatefulProgrammableSwitch)
        .getCharacteristic(Characteristic.ProgrammableSwitchOutputState)
        .updateValue(_propValue ? 1 : 0);
   }
};

module.exports = exports = HomekitSwitchAccessory;
