var util = require('util');
var events = require('events');

function State(_name) {
   this.name = 'state:' + _name;
   this.thing = null;

   events.EventEmitter.call(this);

   var that = this;
}

util.inherits(State, events.EventEmitter);

State.prototype.setThing = function(_thing) {
   this.thing = _thing;
   console.log(this.name + ': ' + _thing.name + ' associated!');
}

module.exports = exports = State;
 
