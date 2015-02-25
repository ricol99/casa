var util = require('util');
var State = require('./state');

function TestState(_name) {

   this.writable = false;

   if (_name.writable) {
      this.writable = _name.writable;
   }

   State.call(this, _name.name, _name.casa);

   this.active = false;

   var that = this;
}

util.inherits(TestState, State);

// *TBD* Could we lose events here?
TestState.prototype.setActive = function(_callback) {

   if (this.active) {
      console.log(this.name + ': Already active, no emit needed!');
      _callback(true);
   }
   else {
      if (this.writable) {
         console.log(this.name + ': Set to active!');
         this.active = true;
         this.emit('active', this.name);
         _callback(true);
      }
      else {
         console.log(this.name + ': Not set to active as not writable!');
         _callback(false);
      }
   }
}

TestState.prototype.setInactive = function(_callback) {

   if (!this.active) {
      console.log(this.name + ': Already inactive, no emit needed!');
      _callback(true);
   }
   else {
      if (this.writable) {
         console.log(this.name + ': Set to inactive!');
         this.active = false;
         this.emit('inactive', this.name);
         _callback(true);
      }
      else {
         console.log(this.name + ': Not set to inactive as not writable!');
         _callback(false);
      }
   }
}

module.exports = exports = TestState;
 
