var util = require('util');
var Action = require('./action');
var push = require( 'pushover-notifications' );
var CasaSystem = require('./casasystem');

function SetStateAction(_config) {

   Action.call(this, _config);

   var that = this;

   function activated() {
      console.log(that.name + ': received activated event');

      console.log(that.name + ': Going active. Attempting to set state ' + that.target.name + ' to active');
      that.target.setActive(function(result) {

         if (result) {
            console.log(that.name + ': Set State ' + that.target.name + ' to active!');
         }
         else {
            console.log(that.name + ': Failed to set State ' + that.target.name + ' to active!');
         }
      });
   }

   function deactivated() {
      console.log(that.name + ': received deactivated event');

      that.target.setInactive(function(result) {

         if (result) {
            console.log(that.name + ': Set State ' + that.target.name + ' to inactive!');
         }
         else {
            console.log(that.name + ': Failed to set State ' + that.target.name + ' to inactive!');
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

util.inherits(SetStateAction, Action);

module.exports = exports = SetStateAction;

