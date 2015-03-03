var util = require('util');
var events = require('events');

function Thing(_config) {
   this.name = _config.name;
   this.displayName = _config.displayName;
   this.owner = _config.owner; // TBD ***** Should this be a string
   this.props = _config.props;
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

Thing.prototype.addAction = function(_action) {
   this.actions[_action.name] = _action;

   _action.on('activated', function (_data) {
      console.log(this.name + ': ' + _data.sourceName + ' has been activated');
   });

   _action.on('deactivated', function (_data) {
      console.log(this.name + ': ' + _data.sourceName + ' has been deactivated');
   });

   console.log(this.name + ': ' + _action.name + ' associated!');
}


Thing.prototype.getProperty = function(_propName) {
   return this.props[_propName];
};

module.exports = exports = Thing;
