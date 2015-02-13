var util = require('util');
var events = require('events');

function State(_name, _thing) {
   this.name = 'state:' + _name;
   this.thing = _thing;

   events.EventEmitter.call(this);

   var that = this;

   if (this.thing) {
      this.thing.addState(this);
   }
}

util.inherits(State, events.EventEmitter);

module.exports = exports = State;
 
