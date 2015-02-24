var util = require('util');
var Action = require('./action');
var push = require( 'pushover-notifications' );
var CasaSystem = require('./casasystem');

function SetStateAction(_name, _source, _state) {

   if (_name.name) {
      // constructing from object rather than params
      // Resolve source and target
      var casaSys = CasaSystem.mainInstance();
      var source = casaSys.findSource(_name.source);
      var target = (_name.target) ? casaSys.resolveObject(_name.target) : null;

      Action.call(this, _name.name, source, target);
   }
   else {
      Action.call(this, _name, _source, _state);
   }

   this.actionActive = false;

   var that = this;

   this.on('activated', function () {
      console.log(that.name + ': received activated event');

      if (!that.actionActive) {
         that.actionActive = true;
         that.state.setActive(function(result) {
            if (!result) {
               console.log(that.name + ': Failed to set State ' + that.source.name + ' to active!'):
            }
         });
      }
   });

   this.on('deactivated', function () {
      console.log(that.name + ': received deactivated event');

      if (that.actionActive) {
         that.actionActive = false;

         that.state.setActive(function(result) {
            if (!result) {
               console.log(that.name + ': Failed to set State ' + that.source.name + ' to active!'):
            }
         });
      }
   });
}

util.inherits(SetStateAction, Action);

module.exports = exports = SetStateAction;

