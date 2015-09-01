var util = require('util');
var Activator = require('./activator');
var CasaSystem = require('./casasystem');

function PropertyActivator(_config) {
   this.sourceActive = false;

   //if (_config.triggerCondition == undefined) {
      //_config.triggerCondition = '==';
      //_config.triggerValue = true;
   //}

   Activator.call(this, _config);

   var that = this;
}

util.inherits(PropertyActivator, Activator);

PropertyActivator.prototype.sourceIsActive = function(_data) {
   this.goActive(_data);
}

PropertyActivator.prototype.sourceIsInactive = function(_data) {
   this.goInactive(_data);
}

module.exports = exports = PropertyActivator;
 
