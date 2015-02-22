var util = require('util');
var events = require('events');
var CasaSystem = require('./casasystem');

function Action(_name, _activator, _thing) {

   this.activator = null;
   this.name = null;
   this.thing = null;

   if (_name.name) {
      // constructing from object rather than params
      var casaSys = CasaSystem.mainInstance();
      this.activator = casaSys.findSource(_name.source);
      this.name = _name.name;
      this.thing = _name.owner;
   }
   else {
      this.name = _name;
      this.activator = _activator;
      this.thing = _thing;
   }

   this.actionEnabled = true;

   events.EventEmitter.call(this);

   var that = this;

   if (this.thing) {
      this.thing.addAction(this);
   }

   this.activator.on('active', function () {
      console.log(that.name + ': ACTIVATED');

      if (that.actionEnabled) {
         that.emit('activated', that.name);
      }
   });

   this.activator.on('inactive', function () {
      console.log(that.name + ': DEACTIVATED');

      if (that.actionEnabled) {
         that.emit('deactivated', that.name);
      }
   });
}

util.inherits(Action, events.EventEmitter);

module.exports = exports = Action;

