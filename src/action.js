var util = require('util');
var events = require('events');
var CasaSystem = require('./casasystem');

function Action(_config) {

   this.name = _config.name;

   // Resolve source and target
   var casaSys = CasaSystem.mainInstance();
   this.casa = casaSys.findCasa(_config.casa);
   this.source = casaSys.findSource(_config.source);
   this.target = (_config.target) ? casaSys.resolveObject(_config.target) : null;

   this.actionEnabled = true;

   events.EventEmitter.call(this);

   var that = this;

   this.casa.addAction(this);

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

