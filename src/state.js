var util = require('util');
var events = require('events');
var CasaSystem = require('./casasystem');

function State(_config) {
   this.name = _config.name;
   this.active = false;

   var casaSys = CasaSystem.mainInstance();
   this.casa = casaSys.findCasa(_config.casa);

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
   console.log(this.name + ': State is read only!');
   _callback(false);
}

State.prototype.setInactive = function(_callback) {
   console.log(this.name + ': State is read only!');
   _callback(false);
}


State.prototype.isActive = function(_callback) {
   console.log(this.name + ': State is read only!');
   _callback(this.active);
}

module.exports = exports = State;
 
