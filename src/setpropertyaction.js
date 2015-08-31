var util = require('util');
var Action = require('./action');
var push = require( 'pushover-notifications' );
var CasaSystem = require('./casasystem');

function SetPropertyAction(_config) {

   this.targetProperty = _config.targetProperty;
   this.targetActiveValue = (_config.targetActiveValue == undefined) ? null : _config.targetActiveValue;
   this.targetInactiveValue = (_config.targetInactiveValue == undefined) ? null : _config.targetInactiveValue;
   this.tempTargetValue = 0;

   Action.call(this, _config);

   var that = this;

   function callback(_result) {

      if (_result) {
         console.log(that.name + ': Set property ' + that.targetProperty + " of " + that.target.name + ' to ' + that.tempTargetValue);
      }
      else {
         console.log(that.name + ': Failed to set property ' + that.targetProperty + " of " + that.target.name + ' to ' + that.tempTargetValue);
      }
   }

   function activated(_data) {
      console.log(that.name + ': received activated event', _data);

      if (that.targetActiveValue != null) {
         that.tempTargetValue = that.targetActiveValue;
         that.target.setProperty(that.targetProperty, that.tempTargetValue, _data, callback);
      }
      else if (_data.applyProps && _data.applyProps.hasOwnProperty(that.targetProperty)) {
         that.tempTargetValue = _data.applyProps[that.targetProperty];
      }
      else {
         console.log(that.name + ": Unable to set property as no value defined and no apply prop found!");
         return;
      }

      console.log(that.name + ': Going active. Attempting to set property ' + that.targetProperty + ' of ' + that.target.name + ' to ' + that.tempTargetValue);
      that.target.setProperty(that.targetProperty, that.tempTargetValue, _data, callback);
   }

   function deactivated(_data) {
      console.log(that.name + ': received deactivated event', _data);

      if (that.targetInactiveValue != null) {
         that.tempTargetValue = that.targetInactiveValue;
         that.target.setProperty(that.targetProperty, that.tempTargetValue, _data, callback);
      }
      else if (_data.applyProps && _data.applyProps.hasOwnProperty(that.targetProperty)) {
         that.tempTargetValue = _data.applyProps[that.targetProperty];
      }
      else {
         console.log(that.name + ": Unable to set property as no value defined and no apply prop found!");
         return;
      }

      console.log(that.name + ': Going inactive. Attempting to set property ' + that.targetProperty + ' of ' + that.target.name + ' to ' + that.tempTargetValue);
      that.target.setProperty(that.targetProperty, that.tempTargetValue, _data, callback);
   }

   this.on('activated', function (_data) {
      activated(_data);
   });

   this.on('activated-from-cold', function (_data) {
      activated(_data);
   });

   this.on('deactivated', function (_data) {
      deactivated(_data);
   });

   this.on('deactivated-from-cold', function (_data) {
      deactivated(_data);
   });
}

util.inherits(SetPropertyAction, Action);

module.exports = exports = SetPropertyAction;

