var util = require('util');
var Thing = require('./thing');

function User(_config) {

   Thing.call(this, _config);

   var that = this;
}

util.inherits(User, Thing);

module.exports = exports = User;
