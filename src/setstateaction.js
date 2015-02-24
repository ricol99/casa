var util = require('util');
var Action = require('./action');
var push = require( 'pushover-notifications' );
var CasaSystem = require('./casasystem');

function SetStateAction(_config) {

   // Resolve source and target
   var casaSys = CasaSystem.mainInstance();
   var source = casaSys.findSource(_config.source);
   this.state = (_config.target) ? casaSys.resolveObject(_config.target) : null;

   Action.call(this, _config.name, source, null);

   this.actionActive = false;

   var that = this;

   this.on('activated', function () {
      console.log(that.name + ': received activated event');

      if (!that.actionActive) {
         that.actionActive = true;
         that.state.setActive(function(result) {

            if (!result) {
               console.log(that.name + ': Failed to set State ' + that.source.name + ' to active!');
            }
         });
      }
   });

   this.on('deactivated', function () {
      console.log(that.name + ': received deactivated event');

      if (that.actionActive) {
         that.actionActive = false;

         that.state.setInActive(function(result) {

            if (!result) {
               console.log(that.name + ': Failed to set State ' + that.source.name + ' to active!');
            }
         });
      }
   });
}

util.inherits(SetStateAction, Action);

module.exports = exports = SetStateAction;

