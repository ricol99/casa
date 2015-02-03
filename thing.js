var util = require('util');
var events = require('events');

function Thing(_name) {
   this.name = 'thing:' + _name;
   this.states = {};
   this.actions = {};

   events.EventEmitter.call(this);
   var that = this;
}

util.inherits(Thing, events.EventEmitter);

Thing.prototype.addState = function(_state) {
   this.states[_state.name] = _state;

   _state.on('active', function (sourceName) {
      console.log(this.name + ': state ' + sourceName + ' has become active');
   });

   _state.on('inactive', function (sourceName) {
      console.log(this.name + ': state ' + sourceName + ' has become inactive');
   });
   console.log(this.name + ': ' + _state.name + ' associated!');
}

Thing.prototype.addAction = function(_action) {
   this.actions[_action.name] = _action;

   _action.on('activated', function (sourceName) {
      console.log(this.name + ': action ' + sourceName + ' has been activated');
   });

   _action.on('deactivated', function (sourceName) {
      console.log(that.name + ': action ' + sourceName + ' has been deactivated');
   });
   console.log(this.name + ': ' + _action.name + ' associated!');
}

module.exports = exports = Thing;
