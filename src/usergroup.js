var util = require('util');
var User = require('./user');

function UserGroup(_config) {
   this.users = [];

   var that = this;

   // TBD - Need to resolve user objects from config object
   _config.users.forEach( function(userName) {
      that.users.push(_config.owner.findUser(userName));
   });

   User.call(this, _config);

}

util.inherits(UserGroup, User);

module.exports = exports = UserGroup;
