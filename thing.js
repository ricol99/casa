
var util = require('util');
var events = require('events');

function Thing(_name, _states, _actions) {
   var name = 'thing:' + _name;
   var states = _states;
   var actions = _actions;

   events.EventEmitter.call(this);
   var that = this;

   var stateKeys = Object.keys(states);

   stateKeys.forEach(function(state) {
      //states[state].setThing(this);  

      states[state].on('active', function (sourceName) {
         console.log(name + ' state ' + sourceName + ' has become active');
      });

      states[state].on('inactive', function (sourceName) {
         console.log(name + ' state ' + sourceName + ' has become inactive');
      });
   });

   console.log(util.inspect(states, false, null));

   var actionKeys = Object.keys(actions);

   actionKeys.forEach(function(action) {
      //actions[actions].setThing(this);  

      actions[action].on('activated', function (sourceName) {
         console.log(name + ' action ' + sourceName + ' has been activated');
      });

      actions[action].on('deactivated', function (sourceName) {
         console.log(name + ' action ' + sourceName + ' has been deactivated');
      });
   });

   console.log(util.inspect(actions, false, null));
}


util.inherits(Thing, events.EventEmitter);

var create = function(_name, _states, _actions) {
   return new Thing(_name, _states, _actions);
}

exports.create = create;
exports.Thing = Thing;

