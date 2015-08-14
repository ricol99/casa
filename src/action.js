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

   this.actionActive = true;

   if (_data.coldStart) {
      this.emit('activated-from-cold', _data);
   }
   else {
      this.emit('activated', _data);
   }
}

Action.prototype.sourceIsInactive = function(_data) {
   console.log(this.name + ': DEACTIVATED', _data);

   this.actionActive = false;

   if (_data.coldStart) {
      this.emit('deactivated-from-cold', _data);
   }
   else {
      this.emit('deactivated', _data);
   }
}

Action.prototype.isActive = function() {
   return this.actionActive;
}

module.exports = exports = Action;

