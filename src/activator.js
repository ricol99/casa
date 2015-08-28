var util = require('util');
var ListeningSource = require('./listeningsource');

function Activator(_config) {

   this.sourceName = _config.source;

   ListeningSource.call(this, _config);

   this.sourceActive = false;
   var that = this;
}

util.inherits(Activator, ListeningSource);

Activator.prototype.sourceIsActive = function(_data) {
   // Do NOTHING by default
}

Activator.prototype.sourceIsInactive = function(_data) {
   // Do NOTHING by default
}

module.exports = exports = Activator;
