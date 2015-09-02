var util = require('util');
var LogicPropertyBinder = require('./logicpropertybinder');

function SettingPropertyBinder(_config, _owner) {
   this.targetProperties = {};

   if (_config.targetProperty != undefined) {
      this.targetProperties[_config.targetProperty] = {};
      this.targetProperties[_config.targetProperty].name = _config.targetProperty;
      this.targetProperties[_config.targetProperty].activeValue = (_config.targetActiveValue == undefined) ? null : _config.targetActiveValue;
      this.targetProperties[_config.targetProperty].inactiveValue = (_config.targetInactiveValue == undefined) ? null : _config.targetInactiveValue;
      this.targetProperties[_config.targetProperty].currentValue = 0;
   }
   else {

      for (var i = 0; i < _config.targetProperties.length; ++i) {
         this.targetProperties[_config.targetProperties[i].name] = {};
         this.targetProperties[_config.targetProperties[i].name].name = _config.targetProperties[i].name;
         this.targetProperties[_config.targetProperties[i].name].activeValue = (_config.targetProperties[i].activeValue == undefined) ? null : _config.targetProperties[i].activeValue;
         this.targetProperties[_config.targetProperties[i].name].inactiveValue = (_config.targetProperties[i].inactiveValue == undefined) ? null : _config.targetProperties[i].inactiveValue;
         this.targetProperties[_config.targetProperties[i].name].currentValue = 0;
      }
   }

   LogicPropertyBinder.call(this, _config, _owner);
}

util.inherits(SettingPropertyBinder, LogicPropertyBinder);

SettingPropertyBinder.prototype.processSourceStateChange = function(_propertyName, _active, _data) {
   var tempValue;

   if (_active && this.targetProperties[_propertyName].activeValue != null) {
      tempValue = this.targetProperties[_propertyName].activeValue;
   }
   else if (!_active && this.targetProperties[_propertyName].inactiveValue != null) {
      tempValue = this.targetProperties[_propertyName].inactiveValue;
   }
   else if (_data.applyProps && _data.applyProps.hasOwnProperty(_propertyName)) {
      tempValue = _data.applyProps[_propertyName];
   }
   else {
      console.log(this.name + ": Unable to set property as no value defined and no apply prop found!");
      return;
   }

   console.log(this.name + ': Attempting to set property ' + _propertyName + ' of ' + this.target.name + ' to ' + tempValue);
   this.target.setProperty(_propertyName, tempValue, _data, function(_result) {

      if (!_result) {
         console.log(this.name + ': Unable to set property ' + _propertyName + '!');
      }
   });
}

SettingPropertyBinder.prototype.sourceIsActive = function(_data) {
   console.log(this.name + ': source has gone active', _data);

   for (var prop in this.targetProperties) {

      if (this.targetProperties.hasOwnProperty(prop)){
         this.processSourceStateChange(prop, true, _data);
      }
   }

}

SettingPropertyBinder.prototype.sourceIsInactive = function(_data) {
   console.log(this.name + ': received deactivated event', _data);

   for (var prop in this.targetProperties) {

      if (this.targetProperties.hasOwnProperty(prop)){
         this.processSourceStateChange(prop, false, _data);
      }
   }
}

module.exports = exports = SettingPropertyBinder;

