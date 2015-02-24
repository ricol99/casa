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

// Override these two functions if you want to support writable states
State.prototype.setActive = function(_callback) {
   console.log(this.name + ': State is read only!");
   _callback(false);
}

State.prototype.setInActive = function(_callback) {
   console.log(this.name + ': State is read only!");
   _callback(false);
}

module.exports = exports = State;
 
