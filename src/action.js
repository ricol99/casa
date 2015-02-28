var util = require('util');
var events = require('events');
var CasaSystem = require('./casasystem');

function Action(_name, _source, _target) {

   this.name = _name;
   this.source = _source;
   this.target = _target;

   this.actionEnabled = true;

   events.EventEmitter.call(this);

   var that = this;

   if (this.target) {
      this.target.addAction(this);
   }

   this.source.on('active', function () {
      console.log(that.name + ': ACTIVATED');

      if (that.actionEnabled) {
         that.emit('activated', { sourceName: that.name });
      }
   });

   this.source.on('inactive', function () {
      console.log(that.name + ': DEACTIVATED');

      if (that.actionEnabled) {
         that.emit('deactivated', { sourceName: that.name });
      }
   });
}

util.inherits(Action, events.EventEmitter);

module.exports = exports = Action;

