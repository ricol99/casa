var util = require('util');
var Action = require('./action');
var push = require( 'pushover-notifications' );
var CasaSystem = require('./casasystem');

function SetPropertyAction(_config) {
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

   Action.call(this, _config);

   var that = this;

   this.on('activated', function (_data) {
      that.activated(_data);
   });

   this.on('activated-from-cold', function (_data) {
      that.activated(_data);
   });

   this.on('deactivated', function (_data) {
      that.deactivated(_data);
   });

   this.on('deactivated-from-cold', function (_data) {
      that.deactivated(_data);
   });
}

util.inherits(SetPropertyAction, Action);

SetPropertyAction.prototype.setProperty = function(_propertyName, _active, _data) {
   var tempValue;

   if (_active && this.targetProperties[_propertyName].activeValue != null) {
      tempValue = this.targetProperties[_propertyName].activeValue;
   }
   else if (!_active && this.targetProperties[_propertyName].inactiveValue != null) {
      tempValue = this.targetProperties[_propertyName].inactiveValue;
   }
   else if (_data.applyProps && _data.applyProps.hasOwnProperty(_propertyName)) {
      tempValue = _data.applyProps[this.targetProperty];
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

SetPropertyAction.prototype.activated = function(_data) {
   console.log(this.name + ': received activated event', _data);

   for (var prop in this.targetProperties) {

      if (this.targetProperties.hasOwnProperty(prop)){
         this.setProperty(prop, true, _data);
      }
   }

}

SetPropertyAction.prototype.deactivated = function(_data) {
   console.log(this.name + ': received deactivated event', _data);

   for (var prop in this.targetProperties) {

      if (this.targetProperties.hasOwnProperty(prop)){
         this.setProperty(prop, false, _data);
      }
   }
}

module.exports = exports = SetPropertyAction;

