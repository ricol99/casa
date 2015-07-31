var util = require('util');
var State = require('./state');

function TestState(_config) {

   State.call(this, _config);

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
         this.goActive({ sourceName: this.name });
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
         this.goInactive({ sourceName: this.name });
         _callback(true);
      }
      else {
         console.log(this.name + ': Not set to inactive as not writable!');
         _callback(false);
      }
   }
}

module.exports = exports = TestState;
 
