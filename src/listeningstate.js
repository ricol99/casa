var util = require('util');
var ListeningSource = require('./listeningsource');
var CasaSystem = require('./casasystem');

function ListeningState(_config) {

   ListeningSource.call(this, _config);

   var that = this;
}

util.inherits(ListeningState, ListeningSource);

ListeningState.prototype.coldStart = function() {

   if (this.active) {
      this.goActive({ coldStart: true });
   }
   else {
      this.goInactive({ coldStart: true });
   }
}

// **
// ** DO NOT OVERRIDE THESE, states should not listen to active/inactive events from any other source
// ** They should only listen to property changes
// **
ListeningState.prototype.sourceIsActive = function(_data) {
   // Do nothing
}

ListeningState.prototype.sourceIsInactive = function(_data) {
   // Do nothing
}

module.exports = exports = ListeningState;
 
