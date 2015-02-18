var util = require('util');
var events = require('events');

function Thing(_name, _displayName, _owner, _props) {
   this.name = _name;
   this.displayName = _displayName;
   this.owner = _owner;
   this.props = _props;
   this.children = {};
   this.states = {};
   this.actions = {};

   events.EventEmitter.call(this);

    if (this.owner) {
      this.owner.addChild(this);
   }
   var that = this;

}

util.inherits(Thing, events.EventEmitter);

Thing.prototype.addChild = function(_child) {
   this.children[_child.name] = _child;
}

Thing.prototype.addState = function(_state) {
   this.states[_state.name] = _state;

   _state.on('active', function (sourceName) {
      console.log(this.name + ': ' + sourceName + ' has become active');
   });

   _state.on('inactive', function (sourceName) {
      console.log(this.name + ': ' + sourceName + ' has become inactive');
   });

   console.log(this.name + ': ' + _state.name + ' associated!');
}

Thing.prototype.addAction = function(_action) {
   this.actions[_action.name] = _action;

   _action.on('activated', function (sourceName) {
      console.log(this.name + ': ' + sourceName + ' has been activated');
   });

   _action.on('deactivated', function (sourceName) {
      console.log(this.name + ': ' + sourceName + ' has been deactivated');
   });

   console.log(this.name + ': ' + _action.name + ' associated!');
}


Thing.prototype.getProperty = function(_propName) {
   return this.props[_propName];
};

module.exports = exports = Thing;
