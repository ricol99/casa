var util = require('util');
var User = require('./user');

function UserGroup(_config, _owner) {
   User.call(this, _config, _owner);

   this.users = [];

   for (var u = 0; u < _config.users.length; ++u) {
      this.users.push(this.gang.findNamedObject(_config.users[u].uName));
   }
}

util.inherits(UserGroup, User);

// Called when system state is required
UserGroup.prototype.export = function(_exportObj) {

   if (User.prototype.export.call(this, _exportObj)) {
      _exportObj.users = [];

      for (var i = 0; i < this.users.length; ++i) {
         _exportObj.users.push = this.users[i].uName;
      }

      return true;
   }

   return false;
};


module.exports = exports = UserGroup;
