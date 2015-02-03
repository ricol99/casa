var util = require('util');
var events = require('events');

function Thing(_name, _states, _actions) {
   this.name = 'thing:' + _name;
   this.states = _states;
   this.actions = _actions;

   events.EventEmitter.call(this);
   var that = this;

   var stateKeys = Object.keys(this.states);

   stateKeys.forEach(function(state) {
      that.states[state].setThing(that);  

      that.states[state].on('active', function (sourceName) {
         console.log(that.name + ' state ' + sourceName + ' has become active');
      });

      that.states[state].on('inactive', function (sourceName) {
         console.log(that.name + ' state ' + sourceName + ' has become inactive');
      });
   });

   //console.log(util.inspect(states, false, null));

   var actionKeys = Object.keys(this.actions);

   actionKeys.forEach(function(action) {
      //actions[actions].setThing(this);  

      that.actions[action].on('activated', function (sourceName) {
         console.log(that.name + ' action ' + sourceName + ' has been activated');
      });

      that.actions[action].on('deactivated', function (sourceName) {
         console.log(that.name + ' action ' + sourceName + ' has been deactivated');
      });
   });
}

util.inherits(Thing, events.EventEmitter);

module.exports = exports = Thing;
