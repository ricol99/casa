var util = require('util');
var User = require('./user');
var CasaSystem = require('./casasystem');

function UserGroup(_config) {
   this.users = [];

   var that = this;

   var casaSys = CasaSystem.mainInstance();

   _config.users.forEach( function(_userName) {
      that.users.push(casaSys.findUser(_userName));
   });

   User.call(this, _config);

}

util.inherits(UserGroup, User);

module.exports = exports = UserGroup;
