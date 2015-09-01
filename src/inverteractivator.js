var util = require('util');
var Activator = require('./activator');

function InverterActivator(_config) {

   this.sourceActive = false;

   Activator.call(this, _config);

   var that = this;
}

util.inherits(InverterActivator, Activator);

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
