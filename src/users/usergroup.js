var util = require('util');
var User = require('../user');

function UserGroup(_config, _owner) {
   User.call(this, _config, _owner);

   this.users = [];
}

util.inherits(UserGroup, User);

// Called when system state is required
UserGroup.prototype.export = function(_exportObj) {
   User.prototype.export.call(this, _exportObj);
   _exportObj.users = [];

   for (var i = 0; i < this.users.length; ++i) {
      _exportObj.users.push(this.users[i].uName);
   }
};

// Called when current state required
UserGroup.prototype.import = function(_importObj) {

   for (var i = 0; i < _importObj.users.length; ++i) {
      this.users.push(this.gang.findNamedObject(_importObj.users[i].uName));
   }

   User.prototype.import.call(this, _importObj);
};

UserGroup.prototype.hotStart = function() {
   User.prototype.hotStart.call(this);
};

UserGroup.prototype.coldStart = function() {

   for (var u = 0; u < _config.users.length; ++u) {
      this.users.push(this.gang.findNamedObject(_config.users[u].uName));
   }

   User.prototype.coldStart.call(this);
};


module.exports = exports = UserGroup;
