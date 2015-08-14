var util = require('util');
var ListeningSource = require('./listeningsource');

function InverterActivator(_config) {

   this.sourceActive = false;

   ListeningSource.call(this, _config);

   var that = this;
}

util.inherits(InverterActivator, ListeningSource);

InverterActivator.prototype.sourceIsActive = function(_data) {
   console.log(this.name + ': source ' + _data.sourceName + ' active!');
   
   this.sourceActive = true;
   this.goInactive(_data);
}

InverterActivator.prototype.sourceIsInactive = function(_data) {
   console.log(this.name + ': source ' + _data.sourceName + ' inactive!');

   this.sourceActive = false;
   this.goActive(_data);
}

module.exports = exports = InverterActivator;
