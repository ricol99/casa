var util = require('util');
var Thing = require('../thing');

// Please provide inputs
// users - users that will be at the location

// Resulting properties

// <user>-present
//   false - not-present - user not at location
//   true - present - user at location

function Location(_config, _parent) {
   Thing.call(this, _config, _parent);

   this.thingType = "location";
   this.users = [];

   for (var u = 0; u < _config.users.length; ++u) {
      this.users.push(this.gang.findNamedObject(_config.users[u].uName));
      this.ensurePropertyExists(this.users[u].name+"-present", 'property', { name: this.users[u].name+"-present", initialValue: false }, _config);
   }
}

util.inherits(Location, Thing);

module.exports = exports = Location;
