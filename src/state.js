var util = require('util');
var Source = require('./source');
var CasaSystem = require('./casasystem');

function State(_config) {

   Source.call(this, _config);

   var that = this;
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
 
