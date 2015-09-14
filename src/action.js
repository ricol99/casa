var util = require('util');
var Worker = require('./worker');

function Action(_config) {

   this.actionActive = false;

   Worker.call(this, _config);

   var that = this;
}

util.inherits(Action, Worker);

Action.prototype.sourceIsActive = function(_data) {
   console.log(this.name + ': ACTIVATED', _data);

   if (!this.actionActive) {
      this.actionActive = true;

      if (_data.coldStart) {
         this.emit('activated-from-cold', _data);
      }
      else {
         this.emit('activated', _data);
      }
   }
   else {
      console.log(this.name + ': Already Active. Not need to activate Action!');
   }

}

Action.prototype.sourceIsInactive = function(_data) {
   console.log(this.name + ': DEACTIVATED', _data);

   if (this.actionActive) {
      this.actionActive = false;

      if (_data.coldStart) {
         this.emit('deactivated-from-cold', _data);
      }
      else {
         this.emit('deactivated', _data);
      }
   }
   else {
      console.log(this.name + ': Already Inactive. Not need to deactivate Action!');
   }
}

Action.prototype.isActive = function() {
   return this.actionActive;
}

module.exports = exports = Action;

