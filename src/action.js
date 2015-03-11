var util = require('util');
var events = require('events');
var CasaSystem = require('./casasystem');

function Action(_config) {

   this.name = _config.name;

   // Resolve source and target
   this.casaSys = CasaSystem.mainInstance();
   this.casa = this.casaSys.casa;
   this.actionEnabled = false;
   this.sourceName = _config.source;
   this.targetName = (_config.target) ? _config.target : null;

   events.EventEmitter.call(this);

   var that = this;

   this.casa.addAction(this);

   this.establishListeners();
}

util.inherits(Action, events.EventEmitter);

Action.prototype.establishListeners = function() {
   var that = this;
   this.source = this.casaSys.findSource(this.sourceName);
   this.actionEnabled = (this.source != null);

   if (this.targetName) {
      this.target = this.casaSys.resolveObject(this.targetName);
      this.actionEnabled = (this.target != null) && (this.source != null);
   }
   else {
      this.target = null;
   }

   if (this.target) {
      this.target.addAction(this);
   }

   if (this.actionEnabled) { 
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

      this.source.on('invalid', function (_data) {
         console.log(that.name + ': INVALID');

         that.actionEnabled = false;
         that.source.removeListener('active', that);
         that.source.removeListener('inactive', that);
         that.source.removeListener('invalid', that);
         that.emit('invalid');
      });

   }
   return this.actionEnabled;
}

module.exports = exports = Action;

