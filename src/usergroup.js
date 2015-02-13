var util = require('util');
var User = require('./user');

function UserGroup(_name, _displayName, _props, _users) {
   this.users = _users;

   User.call(this, 'group:' + _name, _displayName, _props);
   var that = this;
}

util.inherits(UserGroup, User);

User.prototype.getUser = function(_userName) {
   return this.users[_userName];
};

module.exports = exports = UserGroup;
