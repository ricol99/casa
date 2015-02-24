var util = require('util');
var events = require('events');

function State(_name, _casa) {
   this.name = _name;
   this.casa = _casa;

   events.EventEmitter.call(this);

   var that = this;

   if (this.casa) {
      console.log('State casa: ' + this.casa.name);
      this.casa.addState(this);
   }
}

util.inherits(State, events.EventEmitter);

State.prototype.setActive(callback) {
   callback(false);
}

State.prototype.setInActive(callback) {
   callback(false);
}

module.exports = exports = State;
 
