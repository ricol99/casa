var util = require('util');
var User = require('./user');

function UserGroup(_name, _displayName, _users, _owner, _props) {
   this.users = _users;

   User.call(this, 'group:' + _name, _displayName, _owner, _props);
   var that = this;
}

util.inherits(UserGroup, User);

module.exports = exports = UserGroup;
