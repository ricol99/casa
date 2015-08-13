var util = require('util');
var Worker = require('./worker');

function Action(_config) {

   this.actionActive = false;

   Worker.call(this, _config);

   var that = this;
}

util.inherits(Action, Worker);

Action.prototype.oneSourceIsActive = function(_data, _sourceListener, _sourceAttributes) {
   console.log(this.name + ': ACTIVATED', _data);

   if (_data.sourceName == this.sourceName && this.workerEnabled) {

      this.actionActive = true;

      if (_data.coldStart) {
         this.emit('activated-from-cold', _data);
      }
      else {
         this.emit('activated', _data);
      }
   }
}

Action.prototype.oneSourceIsInactive = function(_data, sourceListener, _sourceAttributes) {
   console.log(this.name + ': DEACTIVATED', _data);

   if (_data.sourceName == this.sourceName && this.workerEnabled) {
      this.actionActive = false;

      if (_data.coldStart) {
         this.emit('deactivated-from-cold', _data);
      }
      else {
         this.emit('deactivated', _data);
      }
   }
}

Action.prototype.oneSourcePropertyChanged = function(_data, sourceListener, _sourceAttributes) {
   // DO NOTHING BY DEFAULT
}

Action.prototype.isActive = function() {
   return this.actionActive;
}

module.exports = exports = Action;

