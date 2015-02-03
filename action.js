var util = require('util');
var events = require('events');

function Action(_name, _activator, _thing) {

   this.name = 'action:' + _name;
   this.activator = _activator;
   this.thing = _thing;

   this.actionEnabled = true;

   events.EventEmitter.call(this);

   var that = this;

   if (this.thing) {
      this.thing.addAction(this);
   }
}

util.inherits(Action, events.EventEmitter);

module.exports = exports = Action;

