var util = require('./util');
var Thing = require('./thing');

function Service(_config) {

   if (!_config.hasOwnProperty("local")) {
      _config.local = true;
   }

   if (!_config.hasOwnProperty("propogateToChildren")) {
      _config.propogateToChildren = false;
   }

   Thing.call(this, _config);
}

util.inherits(Service, Thing);

Service.prototype.createThing = function(_config) {
   var type = _config.uName.split(":")[0];
   _config.propogateToParent = (_config.hasOwnProperty('propogateToParent')) ? _config.propogateToParent : false;

   var ServiceOwnedThing = require("./services/things/"+type);
   var thing = new ServiceOwnedThing(_config, this);
   this.gang.casa.refreshSourceListeners();

   return thing;
};

module.exports = exports = Service;
