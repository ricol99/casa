var util = require('util');
var Action = require('./action');
var push = require( 'pushover-notifications' );
var CasaSystem = require('./casasystem');

function SetPropertyAction(_config) {

   this.targetProperty = _config.targetProperty;
   this.targetPropertyActiveValue = _config.targetPropertyActiveValue;
   this.targetPropertyInactiveValue = _config.targetPropertyInactiveValue;

   Action.call(this, _config);

   var that = this;

   function activated() {
      console.log(that.name + ': received activated event');
      console.log(that.name + ': Going active. Attempting to set property ' + that.targetProperty + ' of ' + that.target.name + ' to ' + that.targetPropertyActiveValue);

      that.target.setProperty(that.targetProperty, that.targetPropertyActiveValue, function(result) {

         if (result) {
            console.log(that.name + ': Set property ' + that.targetProperty + " of " + that.target.name + ' to ' + that.targetPropertyActiveValue);
         }
         else {
            console.log(that.name + ': Failed to set property ' + that.targetProperty + " of " + that.target.name + ' to ' + that.targetPropertyActiveValue);
         }
      });
   }

   function deactivated() {
      console.log(that.name + ': received deactivated event');
      console.log(that.name + ': Going active. Attempting to set property ' + that.targetProperty + ' of ' + that.target.name + ' to ' + that.targetPropertyInactiveValue);

      that.target.setProperty(that.targetProperty, that.targetPropertyInactiveValue, function(result) {

         if (result) {
            console.log(that.name + ': Set property ' + that.targetProperty + " of " + that.target.name + ' to ' + that.targetPropertyInactiveValue);
         }
         else {
            console.log(that.name + ': Failed to set property ' + that.targetProperty + " of " + that.target.name + ' to ' + that.targetPropertyInactiveValue);
         }
      });
   }

   this.on('activated', function () {
      activated();
   });

   this.on('activated-from-cold', function () {
      activated();
   });

   this.on('deactivated', function () {
      deactivated();
   });

   this.on('deactivated-from-cold', function () {
      deactivated();
   });
}

util.inherits(SetPropertyAction, Action);

module.exports = exports = SetPropertyAction;

