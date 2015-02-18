var util = require('util');
var User = require('./user');

function UserGroup(_name, _displayName, _users, _owner, _props) {
   this.users = [];

   var that = this;

   if (_name.name) {
      // constructing from object rather than params
      // TBD - Need to resolve user objects from config object
      _name.users.forEach( function(userName) {
         that.users.push(_name.owner.findUser(userName));
      });

      User.call(this, _name.name, _name.displayName, _name.owner, _name.props);
   }
   else {
      this.users = _users;
      User.call(this, _name, _displayName, _owner, _props);
   }

}

util.inherits(UserGroup, User);

module.exports = exports = UserGroup;
