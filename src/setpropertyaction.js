var util = require('util');
var Action = require('./action');
var push = require( 'pushover-notifications' );
var CasaSystem = require('./casasystem');

function SetPropertyAction(_config) {

   this.targetProperty = _config.targetProperty;

   Action.call(this, _config);

   var that = this;

   function activated(_data) {
      console.log(that.name + ': received activated event', _data);

      if (_data.applyProps && _data.applyProps.hasOwnProperty(that.targetProperty)) {
         var targetValue = _data.applyProps[that.targetProperty];
         console.log(that.name + ': Going active. Attempting to set property ' + that.targetProperty + ' of ' + that.target.name + ' to ' + targetValue);

         that.target.setProperty(that.targetProperty, targetValue, function(result) {

            if (result) {
               console.log(that.name + ': Set property ' + that.targetProperty + " of " + that.target.name + ' to ' + targetValue);
            }
            else {
               console.log(that.name + ': Failed to set property ' + that.targetProperty + " of " + that.target.name + ' to ' + targetValue);
            }
         });
      }
   }

   function deactivated(_data) {
      console.log(that.name + ': received deactivated event', _data);

      if (_data.applyProps && _data.applyProps.hasOwnProperty(that.targetProperty)) {
         var targetValue = _data.applyProps[that.targetProperty];
         console.log(that.name + ': Going inactive. Attempting to set property ' + that.targetProperty + ' of ' + that.target.name + ' to ' + targetValue);

         that.target.setProperty(that.targetProperty, targetValue, function(result) {

            if (result) {
               console.log(that.name + ': Set property ' + that.targetProperty + " of " + that.target.name + ' to ' + targetValue);
            }
            else {
               console.log(that.name + ': Failed to set property ' + that.targetProperty + " of " + that.target.name + ' to ' + targetValue);
            }
         });
      }
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

