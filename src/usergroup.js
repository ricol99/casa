var util = require('util');
var User = require('./user');

function UserGroup(_config) {
   this.users = [];

   for (var u = 0; u < _config.users.length; ++u) {
      this.users.push(this.gang.findNamedObject(_config.users[u].fullName));
   }

   User.call(this, _config);

}

util.inherits(UserGroup, User);

module.exports = exports = UserGroup;
