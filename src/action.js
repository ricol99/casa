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

   this.source.on('active', function (_data) {
      console.log(that.name + ': ACTIVATED');

      if (that.actionEnabled) {
         that.emit('activated', _data);
      }
   });

   this.source.on('inactive', function (_data) {
      console.log(that.name + ': DEACTIVATED');

      if (that.actionEnabled) {
         that.emit('deactivated', _data);
      }
   });
}

util.inherits(Action, events.EventEmitter);

module.exports = exports = Action;

