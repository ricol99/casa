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

   this.activator.on('activate', function () {
      console.log('ACTIVATED KHDSGhkdfgsAhfgdhfgdshfgdshgdfhgdhfgdhfgdfhgdghgdfjhdsgfhdsgfhsfghdfsghkdsfgkjdsfgdsfgdshfgdshkfgsdkhdsgfkgs');

      if (that.actionEnabled) {
         that.emit('activated', that.name);
      }
   });

   this.activator.on('deactivate', function () {
      console.log('DEACTIVATED KHDSGhkdfgsAhfgdhfgdshfgdshgdfhgdhfgdhfgdfhgdghgdfjhdsgfhdsgfhsfghdfsghkdsfgkjdsfgdsfgdshfgdshkfgsdkhdsgfkgs');

      if (that.actionEnabled) {
         that.emit('deactivated', that.name);
      }
   });
}

util.inherits(Action, events.EventEmitter);

module.exports = exports = Action;

