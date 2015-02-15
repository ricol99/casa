var util = require('util');
var events = require('events');

function State(_name, _casa) {
   this.name = 'state:' + _name;
   this.casa = _casa;

   events.EventEmitter.call(this);

   var that = this;

   if (this.casa) {
      this.casa.addState(this);
   }
}

util.inherits(State, events.EventEmitter);

module.exports = exports = State;
 
