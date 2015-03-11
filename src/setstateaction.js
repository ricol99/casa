var util = require('util');
var Action = require('./action');
var push = require( 'pushover-notifications' );
var CasaSystem = require('./casasystem');

function SetStateAction(_config) {

   // Resolve source and target
   var casaSys = CasaSystem.mainInstance();

   if (_config.target) {
      this.state = casaSys.findState(_config.target);
      this.stateName = _config.target;
   }
   else {
      this.stateName = '';
   }

   // I don't want to target the state with the generic base class action.js
   _config.target = null;

   Action.call(this, _config);

   if (!this.state) {
      this.actionEnabled = false;
   }

   console.log(_config.name + ': source = '+ this.sourceName);
   console.log(_config.name + ': state = '+ this.stateName);

   this.actionActive = false;

   var that = this;

   this.on('activated', function () {
      console.log(that.name + ': received activated event');

      if (!that.actionActive) {
         console.log(that.name + ': Going active. Attempting to set state ' + that.state.name + ' to active');
         that.actionActive = true;
         that.state.setActive(function(result) {

            if (result) {
               console.log(that.name + ': Set State ' + that.state.name + ' to active!');
            }
            else {
               console.log(that.name + ': Failed to set State ' + that.state.name + ' to active!');
            }
         });
      }
   });

   this.on('deactivated', function () {
      console.log(that.name + ': received deactivated event');

      if (that.actionActive) {
         that.actionActive = false;

         that.state.setInactive(function(result) {

            if (result) {
               console.log(that.name + ': Set State ' + that.state.name + ' to inactive!');
            }
            else {
               console.log(that.name + ': Failed to set State ' + that.state.name + ' to inactive!');
            }
         });
      }
   });
}

util.inherits(SetStateAction, Action);

module.exports = exports = SetStateAction;

