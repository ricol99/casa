var util = require('util');
var Action = require('./action');
var push = require( 'pushover-notifications' );
var CasaSystem = require('./casasystem');

function SetStateAction(_config) {

   Action.call(this, _config);

   var that = this;

   this.on('activated', function () {
      console.log(that.name + ': received activated event');

      if (!that.actionActive) {
         console.log(that.name + ': Going active. Attempting to set state ' + that.target.name + ' to active');
         that.actionActive = true;
         that.target.setActive(function(result) {

            if (result) {
               console.log(that.name + ': Set State ' + that.target.name + ' to active!');
            }
            else {
               console.log(that.name + ': Failed to set State ' + that.target.name + ' to active!');
            }
         });
      }
   });

   this.on('deactivated', function () {
      console.log(that.name + ': received deactivated event');

      if (that.actionActive) {
         that.actionActive = false;

         that.target.setInactive(function(result) {

            if (result) {
               console.log(that.name + ': Set State ' + that.target.name + ' to inactive!');
            }
            else {
               console.log(that.name + ': Failed to set State ' + that.target.name + ' to inactive!');
            }
         });
      }
   });
}

util.inherits(SetStateAction, Action);

module.exports = exports = SetStateAction;

