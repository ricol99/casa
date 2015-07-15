var util = require('util');
var Source = require('./source');
var CasaSystem = require('./casasystem');

function State(_config) {
   this.sourceType = "state";

   var casaSys = CasaSystem.mainInstance();
   this.casa = casaSys.casa;

   Source.call(this, _config);

   var that = this;

   if (this.casa) {
      console.log('State casa: ' + this.casa.name);
      this.casa.addState(this);
   }
}

util.inherits(State, Source);

State.prototype.coldStart = function() {

   if (this.active) {
      this.goActive({ coldStart: true });
   }
   else {
      this.goInactive({ coldStart: true });
   }
}

module.exports = exports = State;
 
