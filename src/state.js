var util = require('util');
var events = require('events');

function State(_name, _casa) {

   if (_name.name) {
      // constructing from object rather than params
      this.name = _name.name;
      this.casa = _name.casa;
   }
   else {
      this.name = _name;
      this.casa = _casa;
   }

   events.EventEmitter.call(this);

   var that = this;

   if (this.casa) {
      this.casa.addState(this);
   }
}

util.inherits(State, events.EventEmitter);

module.exports = exports = State;
 
